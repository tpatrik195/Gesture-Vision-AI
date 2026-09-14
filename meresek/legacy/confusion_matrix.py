# import matplotlib.pyplot as plt
# from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay

# # Valódi címkék (minden esetben Swipe Right volt a cél)
# true_labels = ['Swipe Right'] * 30

# # Predikált címkék a logfájl alapján (16 jó, 12 rossz Swipe Left, 2 None)
# predicted_labels = ['Swipe Right'] * 20 + ['Swipe Left'] * 5 + ['None'] * 4 + ['Zoom In'] * 1

# # Címkék sorrendje (hozzáadva 'None' kategória is)
# labels = ['Swipe Right', 'Swipe Left', 'None']

# # Konfúziós mátrix kiszámítása
# cm = confusion_matrix(true_labels, predicted_labels, labels=labels)

# # Ábra megjelenítése és mentése
# disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=labels)
# disp.plot(cmap="Blues")
# plt.title("Konfúziós mátrix – Dinamikus gesztus (Swipe Right)")
# plt.tight_layout()
# plt.savefig("swipe_confusion_matrix.png")
# plt.show()


import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

# Konfúziós mátrix adatok
data = pd.DataFrame(
    [
        [20, 5, 1, 4],  # Valódi: Swipe Right
        [0, 0, 0, 0],   # Valódi: Swipe Left
        [0, 0, 0, 0],   # Valódi: Zoom In
        [0, 0, 0, 0]    # Valódi: None
    ],
    columns=["Swipe Right", "Swipe Left", "Zoom In", "None"],
    index=["Swipe Right", "Swipe Left", "Zoom In", "None"]
)

# Ábra megjelenítés
plt.figure(figsize=(8, 6))
sns.heatmap(data, annot=True, fmt="d", cmap="Blues", linewidths=1, linecolor="gray", cbar=True)
plt.title("Konfúziós mátrix – Swipe Right gesztus")
plt.xlabel("Felismert gesztus")
plt.ylabel("Valódi gesztus")
plt.tight_layout()
plt.savefig("confusion_matrix.png")
plt.show()
