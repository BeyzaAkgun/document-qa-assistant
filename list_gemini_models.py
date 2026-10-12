from google import genai
from google.genai import errors

from backend.app.config import settings


def main() -> None:
    if settings.gemini_api_key is None:
        print("GEMINI_API_KEY bulunamadı.")
        return

    try:
        with genai.Client(
            api_key=settings.gemini_api_key.get_secret_value()
        ) as client:
            for model in client.models.list():
                actions = model.supported_actions or []

                if "generateContent" in actions:
                    print(model.name)

    except errors.APIError as exc:
        print("Kod:", exc.code)
        print("Durum:", exc.status)


if __name__ == "__main__":
    main()