from pathlib import Path
import os
import httpx
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ConversationHandler, ContextTypes, filters

TOKEN = Path("./Secrets/BOT_TOKEN").read_text().strip()

WAITING_FOR_QUERY = 1


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Please send me a search query.")
    return WAITING_FOR_QUERY


async def handle_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.message.text
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://playwright:3000/run-test",
                json={"query": query},
                timeout=300.0
            )
            if response.status_code == 200:
                await update.message.reply_text(f"✅ Search completed for: {query}")
            else:
                await update.message.reply_text(f"❌ Search failed: {response.text}")
    except Exception as e:
        await update.message.reply_text(f"❌ Error: {str(e)}")

    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Search cancelled.")
    return ConversationHandler.END


app = ApplicationBuilder().token(TOKEN).build()

conv_handler = ConversationHandler(
    entry_points=[CommandHandler("start", start)],
    states={
        WAITING_FOR_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_query)]
    },
    fallbacks=[CommandHandler("cancel", cancel)]
)

app.add_handler(conv_handler)
app.run_polling()
