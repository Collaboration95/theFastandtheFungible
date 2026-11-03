"""LangChain-style callable; no framework dependency. Wrap with @tool if desired."""
import os
from researchagent import Client

client = Client(os.environ.get('RA_URL', 'http://127.0.0.1:10488'), os.environ.get('RA_API_TOKEN'))


def research_expertise(question: str, intent_id: str) -> dict:
    """Research using an operator-fixed S$1 request; reuse intent_id on retries."""
    return client.ask(question, budget=1, idempotency_key=intent_id).result()
