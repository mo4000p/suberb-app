import pandas as pd

input_file = r"C:\Users\peter\OneDrive\Desktop\RTB_OTB_PERF\LTE_OPT_UECELL_DY_V.csv"
output_file = r"C:\Users\peter\daily1000.csv"

df = pd.read_csv(input_file, nrows=1000)
df.to_csv(output_file, index=False)

print(f"Done! Saved 1000 rows to {output_file}")