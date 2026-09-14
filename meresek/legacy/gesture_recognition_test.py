# import matplotlib.pyplot as plt
# import seaborn as sns
# import pandas as pd
# from scipy.stats import chi2_contingency

# statikus = [22, 8]
# dinamikus = [20, 10]

# data = pd.DataFrame(
#     [statikus, dinamikus],
#     columns=["Felismerte", "Nem ismerte"],
#     index=["Statikus", "Dinamikus"]
# )

# chi2, p, dof, expected = chi2_contingency(data)
# print(f"Chi-négyzet érték: {chi2:.3f}, p-érték: {p:.3f}")

# plt.figure(figsize=(6, 4))
# sns.heatmap(data, annot=True, fmt="d", cmap="Blues", cbar=False)
# plt.title("Chi-négyzet próba")
# plt.ylabel("Gesztus típusa")
# plt.xlabel("Felismert állapot")
# plt.tight_layout()
# plt.savefig("chi_squared_heatmap.png")
# plt.show()


import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
from scipy.stats import chi2_contingency

# Új adatok a kétféle gesztusról
statikus = [30, 0]
dinamikus = [28, 2]

data = pd.DataFrame(
    [statikus, dinamikus],
    columns=["Felismerte", "Nem ismerte fel"],
    index=["Statikus", "Dinamikus"]
)

chi2, p, dof, expected = chi2_contingency(data)
print(f"Chi-négyzet érték: {chi2:.3f}, p-érték: {p:.3f}")

plt.figure(figsize=(6, 4))
sns.heatmap(data, annot=True, fmt="d", cmap="Blues", cbar=False)
plt.title("Chi-négyzet próba")
plt.ylabel("Gesztus típusa")
plt.xlabel("Felismert állapot")
plt.tight_layout()
plt.savefig("chi_squared_heatmap.png")
plt.show()
