import pandas as pd
import json

try:
    df = pd.read_excel('Synthetic_Final.xlsx')
    # Clean column names for easier handling
    df.columns = [str(c).strip() for c in df.columns]
    
    # Get basic info
    info = {
        "columns": df.columns.tolist(),
        "total_rows": len(df),
        "sample": df.head(10).to_dict(orient='records')
    }
    
    with open('data_info.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    print("Successfully wrote data_info.json")
except Exception as e:
    print(f"Error: {e}")
