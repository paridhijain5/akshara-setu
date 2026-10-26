# Akshara Setu (ಅಕ್ಷರ ಸೇತು)

**A bridge from Kannada pages to editable, searchable, understandable text.**

Kannada Digital Innovation Hackathon 2026 | **Problem Statement 05: Kannada Text Digitization**

Live demo: https://akshara-setu.lovable.app/ (no login required)

## The problem
Kannada text in photos, scans and old books is just a picture. It can't be searched, copied, read aloud or translated, and typing it by hand is slow.

## What it does
- **Scan:** upload an image or take a photo of printed Kannada
- **Hybrid OCR:** Vision AI for accuracy, with an offline Tesseract.js fallback
- **Edit:** correct mistakes in the recognized text, with Re-scan
- **Listen:** Kannada text-to-speech with read-along word highlighting
- **Translate:** English or Hindi
- **Read in English letters:** Roman-script view for non-Kannada readers
- **Key details:** auto-detects dates, phone numbers, amounts and Kannada numerals
- **Library:** save scans, search across them, export as .txt or JSON

## Tech stack
TanStack Start (React + TypeScript), Tailwind CSS, Lovable Cloud (server function + Lovable AI vision model), Tesseract.js (offline fallback), Web Speech API (kn-IN), MyMemory translation API, Fuse.js, IndexedDB.

## Architecture
Image > resize (max 1600px) > server function calls vision AI (fallback: in-browser Tesseract.js) > editable text > listen / translate / Roman script / key details > saved in browser IndexedDB library. Images are not stored on the server.

## Run locally
git clone https://github.com/paridhijain5/akshara-setu
cd akshara-setu
npm i
npm run dev

Environment variables are managed by Lovable Cloud. No secrets are committed. See `.env.example` for the variable names used.

## Test credentials
None needed. The app has no login.

## Limitations and future scope
Best on clear printed Kannada. Handwriting and Halegannada inscriptions are future work, along with an offline PWA and crowd-sourced corrections.
