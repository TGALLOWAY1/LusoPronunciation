#!/usr/bin/env python3
"""
Gemini-based sentence generator for LusoPronounce.

Generates Brazilian Portuguese sentences using Google's Gemini API.
Outputs CSV format that will be normalized by the TypeScript pipeline.

Usage:
    python scripts/generateGeminiSentences.py --output data/raw/gemini_sentences.csv

Environment variables:
    GEMINI_API_KEY - Required. Your Google Gemini API key.
"""

import argparse
import os
import sys
import time
import google.generativeai as genai

# Categories for sentence generation
CATEGORIES = [
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

def main():
    parser = argparse.ArgumentParser(
        description='Generate Brazilian Portuguese sentences using Gemini API'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='data/raw/gemini_sentences.csv',
        help='Output CSV file path (default: data/raw/gemini_sentences.csv)'
    )
    
    args = parser.parse_args()
    
    # Read API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ Error: GEMINI_API_KEY environment variable is not set.")
        print("   Please set it with: export GEMINI_API_KEY='your-api-key'")
        sys.exit(1)
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    all_sentences = []
    
    print("🚀 Starting generation of sentences via Gemini...\n")
    print(f"   Output will be written to: {args.output}\n")
    
    for category in CATEGORIES:
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
            response = model.generate_content(prompt)
            
            lines = response.text.strip().split('\n')
            clean_lines = [line for line in lines if ";" in line and "Portuguese Sentence" not in line]
            all_sentences.extend(clean_lines)
            
            print(f"      ✓ Generated {len(clean_lines)} sentences")
            time.sleep(2)  # Rate limiting
            
        except Exception as e:
            print(f"      ❌ Error on category '{category}': {e}")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # Write CSV file
    with open(args.output, "w", encoding="utf-8") as f:
        f.write("Portuguese;English\n")
        for line in all_sentences:
            f.write(f"{line}\n")
    
    print(f"\n✅ Done! Generated {len(all_sentences)} sentences.")
    print(f"📂 Saved to: {args.output}")
    print(f"\n💡 Next step: Run 'npm run generate:normalize:sentences' to convert to data/sentences.json")

if __name__ == "__main__":
    main()

