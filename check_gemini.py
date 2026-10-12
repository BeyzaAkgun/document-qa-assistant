from google import genai
from google.genai import errors, types

from backend.app.config import settings


def main() -> None:
    if (
        settings.gemini_api_key is None
        or not settings.gemini_api_key.get_secret_value().strip()
    ):
        print("GEMINI_API_KEY bulunamadı. .env dosyasını kontrol et.")
        return

    print("İstenen model:", repr(settings.gemini_model))

    try:
        with genai.Client(
            api_key=settings.gemini_api_key.get_secret_value(),
            http_options=types.HttpOptions(timeout=30_000),
        ) as client:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=(
                    "Kurgusal örnek metin: "
                    "Erişim talepleri birim yöneticisinin onayından geçer.\n\n"
                    "Soru: Erişim talebini kim onaylıyor?"
                ),
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "Yalnızca verilen örnek metne dayanarak "
                        "Türkçe ve tek cümleyle cevap ver. "
                        "Metinde cevap yoksa yeterli bilgi olmadığını belirt."
                    ),
                    max_output_tokens=200,
                ),
            )

        if response.text:
            print("Model:", settings.gemini_model)
            print("Yanıt:", response.text.strip())
        else:
            print("İstek tamamlandı ancak metin yanıtı gelmedi.")

    except errors.APIError as exc:
        print("Gemini API hatası.")
        print("Kod:", exc.code)
        print("Durum:", exc.status)

        message = str(exc.message)
        if settings.gemini_api_key is not None:
            key = settings.gemini_api_key.get_secret_value()
            if key:
                message = message.replace(key, "[REDACTED]")

        print("Açıklama:", message)

    except Exception as exc:
        print("Bağlantı testi tamamlanamadı.")
        print("Hata türü:", type(exc).__name__)


if __name__ == "__main__":
    main()