"""
Test script for Email Triage API (Grok mode)
Run: python test_api.py
"""

import requests, json

BASE = "http://localhost:5001"

EMAILS = [
    ("Bug — High",      "Our entire dashboard is down since 9 AM. 15 people can't log in — 500 error every time. Client presentation in 2 hours. URGENT!"),
    ("Billing — Med",   "I was charged twice this month, March 1st and March 3rd. Invoice INV-20291. Please refund the duplicate charge."),
    ("Feature — Low",   "Love the product! Could you add dark mode and Google Sheets export? Not urgent, just suggestions for the roadmap."),
    ("General — Low",   "Hi, I'm new. How do I add multiple users to my account and set different permission levels?"),
    ("Unclear",         "Hi, things aren't working like before. Something changed. Can you help?"),
]

def run():
    print("\n── Health ──")
    print(requests.get(f"{BASE}/health").json())

    print("\n── Modes ──")
    print(requests.get(f"{BASE}/modes").json())

    for label, email in EMAILS:
        r = requests.post(f"{BASE}/analyze", json={"email": email})
        data = r.json()
        print(f"\n{'='*55}")
        print(f"  {label}")
        print(f"{'='*55}")
        print(f"  Category  : {data.get('category')}  ({data.get('confidence_score')})")
        print(f"  Urgency   : {data.get('urgency')}")
        print(f"  Team      : {data.get('team')}")
        print(f"  Model     : {data.get('model')}")
        print(f"  Summary   : {data.get('summary')}")
        print(f"  Reasoning : {data.get('reasoning')}")
        if data.get("fallback"):
            print(f"  ⚠ Fallback: {data.get('error')}")

if __name__ == "__main__":
    run()
    print("\n✅ Done")
