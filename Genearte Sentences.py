#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemini sentence generation script for LusoPronunciation.
Requires: pip install -r requirements.txt (or: pip install google-generativeai)
"""
import time
import google.generativeai as genai

import os
import sys
try:
    from dotenv import load_dotenv
    load_dotenv()  # Take environment variables from .env.
except ImportError:
    pass  # If python-dotenv is not installed, proceed with existing environment

# 1. PASTE YOUR API KEY HERE (or set GEMINI_API_KEY env var)
# If you leave it as "YOUR_GEMINI_API_KEY", it will look for the env var.
API_KEY = "YOUR_GEMINI_API_KEY"

# Handle API Key
if API_KEY == "YOUR_GEMINI_API_KEY":
    API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("❌ Error: API Key not found.")
    print("Please replace 'YOUR_GEMINI_API_KEY' in the script with your actual key,")
    print("or set the GEMINI_API_KEY environment variable.")
    sys.exit(1)

genai.configure(api_key=API_KEY)

# Model selection
default_model = "gemini-pro"
model_name = os.getenv("GEMINI_MODEL", default_model)
print(f"📌 Requesting model: {model_name}")

try:
    model = genai.GenerativeModel(model_name)
    # Test the model with a simple prompt to ensure it's valid/available
    print("🧪 Testing model connection...")
    model.generate_content("Hello") 
    print(f"✅ Model '{model_name}' is working!")
except Exception as e:
    print(f"⚠️  Model '{model_name}' failed: {e}")
    print("\n🔍 Listing available models for your API key:")
    try:
        available_models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"   - {m.name}")
                available_models.append(m.name)
        
        # Try to pick a fallback
        fallback = next((m for m in available_models if "gemini-1.5-flash" in m), None)
        if not fallback:
            fallback = next((m for m in available_models if "gemini-pro" in m), None)
            
        if fallback:
            print(f"\n🔄 Falling back to available model: {fallback}")
            model = genai.GenerativeModel(fallback)
        else:
            print("\n❌ No compatible models found. Please check your API key permissions.")
            sys.exit(1)
    except Exception as list_err:
        print(f"❌ Could not list models: {list_err}")
        sys.exit(1)

categories = [
    "Food & Eating",
    "Travel",
    "Family & Friends",
    "Daily Routine",
    "Feelings & Emotions",
    "Questions & Asking for Help",
    "Shopping & Money",
    "Directions & Transport",
    "Work & Study",
    "Small Talk & Social"
]

all_sentences = []

print("🚀 Starting generation of 500 sentences (Legacy SDK)...\n")

for category in categories:
    print(f"   Generating 50 sentences for: {category}...")
    
    prompt = f"""
    Generate a list of 50 distinct, high-frequency Brazilian Portuguese sentences related to the topic: '{category}'.
    
    Strict Rules:
    1. Use natural, spoken Brazilian Portuguese (pt-BR).
    2. Sentences should vary in complexity (mix of simple and intermediate).
    3. Include the English translation.
    4. Format the output strictly as a CSV with no header, like this:
       "Portuguese Sentence";"English Translation"
    5. Do not number the lines. Do not add introductory text.
    """

    try:
        # The syntax here is the main difference from the previous script
        response = model.generate_content(prompt)
        
        lines = response.text.strip().split('\n')
        clean_lines = [line for line in lines if ";" in line and "Portuguese Sentence" not in line]
        all_sentences.extend(clean_lines)
        
        time.sleep(2)

    except Exception as e:
        print(f"❌ Error on category '{category}': {e}")

filename = "brazilian_portuguese_custom_legacy.csv"
with open(filename, "w", encoding="utf-8") as f:
    f.write("Portuguese;English\n") 
    for line in all_sentences:
        f.write(f"{line}\n")

print(f"\n✅ Done! Generated {len(all_sentences)} sentences.")
print(f"📂 Saved to: {filename}")