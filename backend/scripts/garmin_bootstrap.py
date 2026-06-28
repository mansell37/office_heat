"""Generate a Garmin auth token for the GARMIN_TOKENS_B64 env var.

Run this ONCE on your own machine (a trusted home IP avoids rate-limits/MFA
hassles). It logs into Garmin, serialises the session, and prints a base64
string to paste into Railway as GARMIN_TOKENS_B64.

    cd backend
    .venv/Scripts/python scripts/garmin_bootstrap.py

NOTE: garth tokens are account-level, so a token you already generated for
another app (e.g. ripe_fitness) works here unchanged — you only need this if you
don't have one or it has expired.
"""
import base64
import getpass
import sys


def main():
    try:
        from garminconnect import Garmin
    except ImportError:
        print("ERROR: garminconnect not installed. Run: uv pip install -r requirements.txt")
        sys.exit(1)

    email = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password: ")

    def prompt_mfa():
        return input("Enter the one-time code Garmin emailed you: ").strip()

    print("\nLogging into Garmin Connect...")
    try:
        client = Garmin(email, password, prompt_mfa=prompt_mfa)
        client.login()
    except Exception as e:
        print(f"\nERROR: Login failed — {e}")
        print("If you see a 429 rate-limit error, wait 15–30 minutes and retry.")
        sys.exit(1)

    token_json = client.garth.dumps()
    encoded = base64.b64encode(token_json.encode()).decode()

    print("\n" + "=" * 60)
    print("SUCCESS — set this as GARMIN_TOKENS_B64 in Railway:")
    print("=" * 60)
    print(encoded)
    print("=" * 60)


if __name__ == "__main__":
    main()
