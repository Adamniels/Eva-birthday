# Eva Quiz — Setup Guide

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free, no credit card)
2. Click **New Project**, give it a name like "eva-birthday", pick a region close to Denmark
3. Wait for the project to spin up (~1 min)
4. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public** key

## 2. Run the database schema

1. In your Supabase project, go to **SQL Editor**
2. Open `supabase-schema.sql` from this folder
3. Paste the entire contents into the SQL Editor and click **Run**

## 3. Set up environment variables

Copy the example file and fill it in:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
HOST_PASSWORD=choose-a-password-here
```

## 4. Run locally to test

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com), import the repo
3. In **Environment Variables**, add the three variables from your `.env.local`
4. Click **Deploy** — done!

---

## How the quiz works

### Before the party
Share the URL with guests. They open it, type their name, and answer all questions. They can return and change answers until you lock it.

### At the party — reveal flow

1. Go to `/host` on your phone or laptop
2. Enter the host password
3. Click **"Luk for nye svar"** when ready — no more changes allowed
4. Click **"Start afsløringen"** — all guest phones jump to the reveal screen
5. Click **"Næste spørgsmål"** to go through each question one by one
   - For open-text questions: mark each answer correct (✓) or wrong (✗) before advancing
6. After the last question, click **"Afslut quiz"** — everyone sees the final leaderboard

---

## Editing questions

Open `questions.json` and edit freely. Each question looks like:

```json
{
  "id": 1,
  "type": "multiple_choice",
  "question": "Your question here?",
  "image": null,
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct": 0,
  "points": 10
}
```

- `type`: either `"multiple_choice"` or `"open_text"`
- `correct`: for multiple choice, the **index** of the correct option (0 = first, 1 = second, etc.)
- `correct`: for open text, the **exact answer string** (used for reference during grading)
- `image`: either `null` or a path like `"/images/photo.jpg"` (put images in `public/images/`)
- `points`: how many points a correct answer is worth (default 10)
