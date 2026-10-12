from google.genai import errors

from backend.app.llm_service import (
    InvalidLLMResponseError,
    LLMConfigurationError,
    generate_answer,
)


def main() -> None:
    sources = {
        "S1": (
            "KURGUSAL ÖRNEK PROSEDÜR: "
            "Erişim talepleri birim yöneticisinin onayından geçer."
        )
    }

    questions = [
        "Erişim talebini kim onaylıyor?"
    ]

    for question in questions:
        print("\nSoru:", question)

        try:
            result = generate_answer(question, sources)
            print(result.model_dump_json(indent=2))

        except errors.APIError as exc:
            print("API hatası:", exc.code, exc.status)

        except (InvalidLLMResponseError, LLMConfigurationError) as exc:
            print("Kontrol hatası:", str(exc))

        except Exception as exc:
            print("İstek tamamlanamadı:", type(exc).__name__)


if __name__ == "__main__":
    main()