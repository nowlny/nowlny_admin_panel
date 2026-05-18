import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileData, mimeType, customApiKey } = body;

    if (!fileData) {
      return NextResponse.json(
        { error: "No file data received in request." },
        { status: 400 }
      );
    }

    // Resolve API key: first check headers/body for custom client key, then fallback to environment
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "Gemini API Key is missing. Please paste your Gemini API Key in the 'AI Settings' key box on the screen or set it as GEMINI_API_KEY in your server environment." 
        },
        { status: 400 }
      );
    }

    // Prepare prompt instructing Gemini to do structural OCR extraction and return structured JSON
    const prompt = `
      You are an expert menu digitizer and OCR extractor. 
      Analyze the attached menu document (which could be an image of a flyer, a PDF menu, or a spreadsheet).
      Extract all menu items, their descriptions, their prices, and group them into logical categories (e.g., Appetizers, Main Dishes, Drinks, Special Menu, Desserts).
      
      Requirements:
      1. Correctly parse and extract all dishes, sweet items, appetizers, and beverages.
      2. Clean up item titles. If a price is embedded in the title, extract it separately into the 'price' field.
      3. For 'price', extract it strictly as a floating-point number. Do not include currency symbols. If no price is found, assign 0.00.
      4. Try to write a concise, appetizing description for each item if none is present or if it's brief.
      5. Group items into their correct category name.
      
      You must respond strictly with a valid JSON matching this schema:
      {
        "categories": [
          {
            "name": "Category Name",
            "items": [
              {
                "name": "Item Name",
                "description": "Item Description",
                "price": 12.99,
                "category": "Category Name"
              }
            ]
          }
        ]
      }
    `;

    // Construct request payload for Gemini Multimodal API (supports images, pdfs, and excels)
    const geminiPayload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || "image/png",
                data: fileData // base64 string
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1 // Low temperature for high precision OCR extraction
      }
    };

    const modelName = "gemini-2.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(geminiPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini API responded with error: ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Extract the raw text from the Gemini model's response candidate
    const candidates = result.candidates || [];
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No response candidates returned by Gemini model." },
        { status: 500 }
      );
    }

    const textResponse = candidates[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return NextResponse.json(
        { error: "Empty content received from Gemini model response." },
        { status: 500 }
      );
    }

    // Parse the JSON returned by the model
    let parsedMenu;
    try {
      parsedMenu = JSON.parse(textResponse.trim());
    } catch (parseError) {
      // In case there is some stray text wrap, try to extract JSON block using regex
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedMenu = JSON.parse(jsonMatch[0].trim());
      } else {
        return NextResponse.json(
          { error: `Failed to parse Gemini text response as JSON. Raw response: ${textResponse}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsedMenu);

  } catch (error: any) {
    return NextResponse.json(
      { error: `Internal Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}
