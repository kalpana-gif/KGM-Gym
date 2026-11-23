"""Reproduce src/data/usda.json from the official USDA SR Legacy CSV ZIP.
Usage: python3 scripts/extract_usda.py /path/to/FoodData_Central_sr_legacy_food_csv_2018-04.zip
Dataset: https://fdc.nal.usda.gov/download-datasets
USDA data is public domain. Preserve the source description and FDC IDs.
"""
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

SELECTED = {
    "rice-red": ("169704", "Cooked red rice", ["red rice", "brown rice"], "grain", "cooked", [], True, "Cooked brown rice proxy; local red rice varieties differ."),
    "rice-white": ("168878", "Cooked white rice", ["white rice", "cooked white rice"], "grain", "cooked", [], True, ""),
    "rice-raw": ("168877", "Uncooked white rice", ["raw rice", "uncooked rice"], "grain", "raw", [], True, ""),
    "lentils": ("172421", "Boiled lentils", ["lentils", "boiled lentils"], "protein", "cooked", [], True, ""),
    "chicken": ("171477", "Cooked chicken breast", ["chicken breast"], "protein", "cooked", [], False, ""),
    "fish": ("175177", "Cooked fish", ["plain fish", "cooked fish"], "protein", "cooked", ["fish"], False, "Cooked tilapia reference; fish species differ."),
    "egg": ("173424", "Boiled egg", ["egg", "eggs", "boiled eggs"], "protein", "cooked", ["egg"], True, ""),
    "mung": ("174257", "Boiled green gram", ["green gram", "mung beans"], "protein", "cooked", [], True, ""),
    "chickpeas": ("173757", "Boiled chickpeas", ["chickpeas", "kadala"], "protein", "cooked", [], True, ""),
    "coconut-milk": ("170172", "Coconut milk", ["coconut milk"], "extra", "raw", ["coconut"], True, "Full-fat coconut milk reference; dilution changes values."),
    "oil": ("171412", "Coconut oil", ["oil", "coconut oil"], "extra", "ready", ["coconut"], True, ""),
    "coconut": ("170169", "Grated coconut", ["coconut", "grated coconut"], "extra", "raw", ["coconut"], True, ""),
    "greens-raw": ("168462", "Raw leafy greens", ["raw greens", "spinach"], "vegetable", "raw", [], True, "Spinach proxy; gotukola and other greens differ."),
    "greens": ("168463", "Cooked leafy greens", ["cooked greens"], "vegetable", "cooked", [], True, "Cooked spinach proxy; local greens differ."),
    "onion": ("170000", "Onion", ["onions"], "vegetable", "raw", [], True, ""),
    "tomato": ("170457", "Tomato", ["tomatoes"], "vegetable", "raw", [], True, ""),
    "carrot": ("170394", "Cooked carrot", ["carrots", "carrot"], "vegetable", "cooked", [], True, ""),
    "beans": ("169141", "Cooked green beans", ["green beans"], "vegetable", "cooked", [], True, ""),
    "banana": ("173944", "Banana", ["bananas"], "fruit", "raw", [], True, ""),
    "papaya": ("169926", "Papaya", ["papaw"], "fruit", "raw", [], True, ""),
    "curd": ("171284", "Plain curd", ["curd", "yogurt", "yoghurt"], "protein", "ready", ["milk"], True, "Whole-milk yogurt proxy; buffalo curd may differ."),
    "milk": ("171265", "Whole milk", ["milk"], "protein", "ready", ["milk"], True, ""),
    "bread": ("172688", "Whole-wheat bread", ["bread", "whole wheat bread"], "grain", "ready", ["wheat"], True, ""),
    "wheat-flour": ("168893", "Whole-wheat flour", ["wheat flour"], "grain", "raw", ["wheat"], True, ""),
    "white-flour": ("169761", "White all-purpose flour", ["white flour", "all purpose flour", "plain flour"], "grain", "raw", ["wheat"], True, ""),
    "potato": ("170440", "Boiled potato", ["potato", "potatoes", "boiled potatoes"], "vegetable", "cooked", [], True, ""),
    "butter": ("173410", "Salted butter", ["butter"], "extra", "ready", ["milk"], True, ""),
    "rice-flour": ("169714", "Rice flour", ["rice flour"], "grain", "raw", [], True, ""),
    "sugar": ("169655", "Sugar", ["sugar"], "extra", "ready", [], True, ""),
    "lime": ("168156", "Lime juice", ["lime juice"], "extra", "raw", [], True, ""),
}

z = zipfile.ZipFile(sys.argv[1])
prefix = z.namelist()[0]
def rows(name):
    return csv.DictReader(io.TextIOWrapper(z.open(prefix + name)))

foods = {r["fdc_id"]: r for r in rows("food.csv")}
ids = {v[0] for v in SELECTED.values()}
values = {i: {} for i in ids}
for r in rows("food_nutrient.csv"):
    if r["fdc_id"] in ids and r["nutrient_id"] in {"1008", "1003", "1004", "1005"}:
        values[r["fdc_id"]][r["nutrient_id"]] = float(r["amount"])

result = []
for key, (fdc, name, aliases, group, state, allergens, vegetarian, proxy) in SELECTED.items():
    n = values[fdc]
    assert all(k in n for k in ("1008", "1003", "1004", "1005")), key
    source = f"USDA FoodData Central SR Legacy; FDC {fdc}: {foods[fdc]['description']}."
    if proxy:
        source += " " + proxy
    servings = [{"label": "100 g", "grams": 100, "approximate": False}]
    if key == "egg":
        servings.append({"label": "piece", "grams": 50, "approximate": False})
    if key == "bread":
        servings.append({"label": "slice", "grams": 28, "approximate": True})
    if key.startswith("rice-") and state == "cooked":
        servings.append({"label": "cup", "grams": 180, "approximate": True})
    result.append(dict(id=key, name=name, aliases=aliases, kcal=n["1008"],
                       macros=dict(protein=n["1003"], fat=n["1004"], carbs=n["1005"]),
                       state=state, group=group, servings=servings, source=source,
                       sourceUrl=f"https://fdc.nal.usda.gov/food-details/{fdc}/nutrients",
                       uncertainty="recipe estimate" if proxy else "reference",
                       allergens=allergens, vegetarian=vegetarian))
Path("src/data").mkdir(parents=True, exist_ok=True)
Path("src/data/usda.json").write_text(json.dumps(result, indent=2) + "\n")
print(f"Extracted {len(result)} traceable foods.")
