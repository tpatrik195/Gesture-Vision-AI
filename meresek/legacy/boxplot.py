# import pandas as pd
# import matplotlib.pyplot as plt
# import seaborn as sns
# import numpy as np

# # CSV fájl beolvasása
# df = pd.read_csv('client_api_latency.csv')  # Cseréld ki a fájl nevét a saját fájlodra

# # A 'Duration (ms)' oszlopot használjuk a boxplothoz
# duration = df['Duration (ms)']

# # Boxplot készítése
# plt.figure(figsize=(10, 6))
# sns.boxplot(data=duration, color='skyblue', linewidth=2)

# # Átlag és szórás hozzáadása
# mean_duration = np.mean(duration)
# std_duration = np.std(duration)

# plt.axhline(mean_duration, color='red', linestyle='--', label=f'Átlag: {mean_duration:.2f} ms')
# plt.axhline(mean_duration + std_duration, color='green', linestyle='--', label=f'1 Szórás: {mean_duration + std_duration:.2f} ms')
# plt.axhline(mean_duration - std_duration, color='green', linestyle='--', label=f'-1 Szórás: {mean_duration - std_duration:.2f} ms')

# # Outlierek kiemelése
# outliers = duration[duration > (mean_duration + 1.5 * std_duration)] # Outlierek
# plt.scatter(outliers.index, outliers, color='red', label='Outlierek')

# # Címek és jelmagyarázat
# plt.title('Boxplot: Duration (ms) értékek')
# plt.xlabel('Időtartam (ms)')
# plt.ylabel('Értékek')
# plt.legend()

# # Megjelenítés
# plt.show()


import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

data = {
    "Duration": [
        340, 146, 415, 141, 140, 828, 658, 133, 393, 256, 272, 132, 634, 129, 258,
        373, 137, 251, 131, 137, 142, 141, 132, 267, 780, 143, 135, 760, 480, 134,
        374, 138, 136, 130, 134, 252, 142, 130, 130, 139, 510, 425, 139, 128, 652,
        370, 595, 247, 134, 508, 492, 403, 240, 124, 435, 141, 142, 129, 379, 378,
        603, 390, 510, 127, 134, 129, 623, 251, 385, 133, 144, 130, 136, 134, 513,
        156, 129, 264, 136, 130, 151, 124, 129, 395, 135, 137, 136, 135, 185, 252,
        128, 148, 132, 369, 749, 513, 505
    ]
}

df = pd.DataFrame(data)

mean_duration = np.mean(df["Duration"])
std_duration = np.std(df["Duration"])

plt.figure(figsize=(10, 6))

sns.boxplot(data=df["Duration"], color="skyblue", linewidth=2)

plt.axhline(mean_duration, color='red', linestyle='-', label=f'Átlag: {mean_duration:.2f} ms')
plt.axhline(mean_duration + std_duration, color='green', linestyle='-', label=f'Átlag + Szórás: {mean_duration + std_duration:.2f} ms')
plt.axhline(mean_duration - std_duration, color='green', linestyle='-', label=f'Átlag - Szórás: {mean_duration - std_duration:.2f} ms')

plt.title("Boxplot")
plt.ylabel("milliszekundum (ms)")
plt.legend(loc='upper right')

plt.grid(True)
plt.show()
