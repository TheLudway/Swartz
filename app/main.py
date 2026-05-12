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
                await update.message.reply_text(f"✅ Search completed for: {query}")
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
