import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv(override=True)

key = os.getenv("GROQ_API_KEY")

print("Key loaded:", bool(key))

if not key:
    print("GROQ_API_KEY not found")
    exit()

client = Groq(api_key=key)

try:
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": "Say hello in one short sentence."
            }
        ]
    )

    print("\n==============================")
    print("GROQ CONNECTION SUCCESS")
    print("==============================")

    print(response.choices[0].message.content)

except Exception as e:
    print("\n==============================")
    print("GROQ ERROR")
    print("==============================")

    print(type(e).__name__)
    print(e)