import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('client_api_latency.csv')

# Ábrázolás
plt.figure(figsize=(10, 6))
plt.scatter(df['Frame Index'], df['Duration (ms)'], color='b', marker='s', label='Latency Duration')

# Pontok mellé az értékek hozzáadása
for i in range(len(df)):
    plt.text(df['Frame Index'][i], df['Duration (ms)'][i], f"({df['Frame Index'][i]}, {df['Duration (ms)'][i]})", 
             fontsize=8, ha='right', va='bottom', color='green')

# Beállítások
plt.title('Latency Duration vs Frame Index')
plt.xlabel('Frame Index')
plt.ylabel('Latency Duration (ms)')
plt.ylim(0, 1000)  # Y tengely skálázása 0-tól 1000-ig
plt.grid(True)
plt.tight_layout()

# Megjelenítés
plt.show()