"""Install packages/sdk-python first; backend operator sets spending caps."""
import os
from researchagent import Client

client = Client(os.environ.get('RA_URL', 'http://127.0.0.1:8788'), os.environ.get('RA_API_TOKEN'))
task = client.ask('What is the analyst outlook on the Kestrel Semiconductor deal with TSMC (pricing & margins)?',
                  budget=1, idempotency_key='python-quickstart-1')
for event in task.events:
    print(event['type'], event['label'])
result = task.result()
print(result['answer'], result['citations'], result['receipts'])
print('clamped:', result['clamped'], result['labels'])
