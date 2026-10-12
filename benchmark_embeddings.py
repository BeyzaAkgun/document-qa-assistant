from statistics import median
from time import perf_counter
import resource

import psutil
import torch
from sentence_transformers import SentenceTransformer


MODEL_NAME = "intfloat/multilingual-e5-small"
process = psutil.Process()


def show_memory(label: str) -> None:
    process_mib = process.memory_info().rss / 1024**2
    available_gib = psutil.virtual_memory().available / 1024**3

    print(f"\n[{label}]")
    print(f"Python RAM: {process_mib:.0f} MiB")
    print(f"Available system RAM: {available_gib:.2f} GiB")


torch.set_num_threads(2)
show_memory("Before model")

start = perf_counter()
model = SentenceTransformer(MODEL_NAME, device="cpu")
print(f"\nModel load time: {perf_counter() - start:.2f} seconds")
show_memory("After model")

documents = [
    "Erişim talepleri birim yöneticisinin onayından geçer.",
    "Seyahat masrafları için fatura ve ödeme belgesi sunulmalıdır.",
    "Teknik sorunlar BT destek portalı üzerinden bildirilir.",
]

start = perf_counter()
document_vectors = model.encode(
    [f"passage: {text}" for text in documents],
    batch_size=2,
    normalize_embeddings=True,
    show_progress_bar=False,
)
print(f"\nDocument encoding time: {perf_counter() - start:.3f} seconds")
print(f"Document vectors shape: {document_vectors.shape}")
show_memory("After documents")

questions = [
    "Sisteme erişmek için kimin onayı gerekiyor?",
    "Who approves access requests?",
]

for question in questions:
    durations = []

    # İlk çalıştırmayı ısınma kabul edip sonraki 5 ölçümü kullanıyoruz.
    for run in range(6):
        start = perf_counter()
        question_vector = model.encode(
            f"query: {question}",
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        elapsed = perf_counter() - start

        if run > 0:
            durations.append(elapsed)

    scores = document_vectors @ question_vector
    ranking = scores.argsort()[::-1]

    print(f"\nQuestion: {question}")
    print(f"Median query encoding: {median(durations) * 1000:.0f} ms")

    for index in ranking:
        print(f"  {scores[index]:.3f} | {documents[index]}")

show_memory("After queries")

# Linux'ta ru_maxrss KiB cinsindedir.
peak_mib = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
print(f"\nPeak Python RAM: {peak_mib:.0f} MiB")