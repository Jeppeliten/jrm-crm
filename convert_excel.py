import pandas as pd
import json

def convert():
    df = pd.read_excel('Synthetic_Final.xlsx')
    # Clean column names
    df.columns = [str(c).strip() for c in df.columns]
    
    # Map to more friendly keys
    data = []
    for _, row in df.iterrows():
        item = {
            "id": str(row.get('Mäklarpaket.UID', '')),
            "firstName": str(row.get('Mäklare - Namn', '')),
            "lastName": str(row.get('Efternamn', '')),
            "brokerage": str(row.get('Företag - namn', '')),
            "brand": str(row.get('Företag - kedja/varumärke', '')),
            "city": str(row.get('Företag - postort', '')),
            "isActive": bool(row.get('Mäklarpaket.Aktiv', False)),
            "cost": float(row.get('Mäklarpaket.Totalkostnad', 0)) if pd.notnull(row.get('Mäklarpaket.Totalkostnad')) else 0,
            "discount": float(row.get('Mäklarpaket.Rabatt', 0)) if pd.notnull(row.get('Mäklarpaket.Rabatt')) else 0,
            "customerNumber": str(row.get('Mäklarpaket.KundNr', '')) if pd.notnull(row.get('Mäklarpaket.KundNr')) else '',
            "productName": str(row.get('Mäklarpaket.ProduktNamn', '')),
            "email": str(row.get('Mäklarpaket.Epost', '')),
            "registrationType": str(row.get('Registreringstyp', '')),
            "products": str(row.get('Produkter', ''))
        }
        data.append(item)
    
    with open('sweden-broker-crm/src/data/brokers.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=None)

if __name__ == "__main__":
    import os
    os.makedirs('sweden-broker-crm/src/data', exist_ok=True)
    convert()
    print("Exported data to sweden-broker-crm/src/data/brokers.json")
