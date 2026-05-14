from pathlib import Path
import os
import httpx
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ConversationHandler, ContextTypes, filters

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

TOKEN = Path("./Secrets/BOT_TOKEN").read_text().strip()

WAITING_FOR_QUERY = 1


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    logger.info(f"User {user_id} started search conversation")
    await update.message.reply_text("Please send me a search query.")
    return WAITING_FOR_QUERY


async def handle_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.message.text
    user_id = update.effective_user.id
    logger.info(f"User {user_id} submitted query: '{query}'")
    
    try:
        logger.info(f"Sending request to playwright server with query: '{query}'")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://playwright:3000/run-test",
                json={"query": query},
                timeout=300.0
            )
            logger.info(f"Received response from playwright server: status_code={response.status_code}")
            if response.status_code == 200:
                logger.info(f"Search completed successfully for query: '{query}'")
                
                response_data = response.json()
                results = response_data.get("results", [])
                page_load_info = response_data.get("page_load_info")
                
                if results:
                    message = f"✅ Found {len(results)} results for: {query}\n\n"
                    for i, torrent in enumerate(results, 1):
                        title = torrent.get("title", "N/A").strip() if torrent.get("title") else "N/A"
                        size = torrent.get("size", "N/A")
                        seeds = torrent.get("seeds", "N/A")
                        downloads = torrent.get("downloads", "N/A").strip() if torrent.get("downloads") else "N/A"
                        
                        message += f"{i}. {title}\n"
                        message += f"   Size: {size.strip()} | Seeds: {seeds.strip()} | Downloads: {downloads.strip()}\n\n"
                    
                    await update.message.reply_text(message)
                    
                    if page_load_info and page_load_info.get("page_loaded"):
                        torrent_title = page_load_info.get("torrent_title", "N/A")
                        download_file = page_load_info.get("download_file", "N/A")
                        download_path = page_load_info.get("download_path", "N/A")
                        page_message = f"📄 Torrent page loaded successfully!\n\n"
                        page_message += f"📌 Title: {torrent_title}\n"
                        page_message += f"⬇️ Download: {download_file}\n"
                        page_message += f"📁 Location: {download_path}"
                        await update.message.reply_text(page_message)
                else:
                    await update.message.reply_text(f"✅ Search completed for: {query}\nNo results found.")
            else:
                logger.warning(f"Search failed for query '{query}': {response.text}")
                await update.message.reply_text(f"❌ Search failed: {response.text}")
    except Exception as e:
        logger.error(f"Error during search for query '{query}': {str(e)}", exc_info=True)
        await update.message.reply_text(f"❌ Error: {str(e)}")

    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    logger.info(f"User {user_id} cancelled search")
    await update.message.reply_text("Search cancelled.")
    return ConversationHandler.END


logger.info("Initializing Telegram bot application")
app = ApplicationBuilder().token(TOKEN).build()

conv_handler = ConversationHandler(
    entry_points=[CommandHandler("start", start)],
    states={
        WAITING_FOR_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_query)]
    },
    fallbacks=[CommandHandler("cancel", cancel)]
)

app.add_handler(conv_handler)
logger.info("Telegram bot ready, starting polling")
app.run_polling()
