# "Invade Sync" iOS Shortcut

Web apps can't read Apple Health. A Shortcut can, so this one bridges Health to our server. **Build it once** (Emir, ~10 min), share the iCloud link, and every player installs that same Shortcut. The shared version holds no personal data: each player replaces `PASTE-YOUR-CODE-HERE` in its first card with their own private code.

What it sends: **today's step total only** → `POST /api/steps { token, steps }`. The server keeps the highest total per day, so running it any number of times is safe.

## Build it (Shortcuts app → **+**), verified on iOS in Turkish

Name it exactly **`Invade Sync`** (the app's Sync button opens it by this name).

| # | Action (EN / TR) | Settings |
|---|---|---|
| 1 | **Text / Metin** | The player's code, e.g. `INV-DRH5-…`. In the **shared** version: `PASTE-YOUR-CODE-HERE`. Nothing else in the box (no variable bubbles) |
| 2 | **Find Health Samples / Sağlık Örneklerini Bul** | Type **Steps / Adım** · Start Date **is today / bugün** · Group By **Day / Gün** |
| 3 | **Calculate Statistics / İstatistikleri Hesapla** | **Sum / Topla** of *Health Samples* |
| 4 | **Get Contents of URL / URL'nin İçeriğini Al** | URL `https://invade.vercel.app/api/steps` · Method **POST** · Request Body **JSON**: `token` (Text) = *Text/Metin*, `steps` (Number/Sayı) = *Statistics/Topla* |
| 5 | **Show Notification / Bildirim Göster** | *Contents of URL / URL'nin İçeriği* |

No date is sent: the server uses today's game day (it owns the clock). If a new card's URL field auto-fills with a variable, tap the bubble → **Clear Variable / Değişkeni Sil**, then type the address.

The first run asks for **Health access**: allow **Steps**, and allow the connection to invade.vercel.app.

### Apple Watch note (the double counting check)

Health stores steps from both the iPhone and the Watch, and adding up the raw records can count some steps twice. **Group By: Day** in step 2 makes Health return its own de-duplicated daily total. **Verify:** after syncing, compare the notification's number with Health app → Steps → Today. If they differ (only possible for Watch owners), change step 2 to filter **Source is <this iPhone's name>** and remove Group By.

## Share it

**First replace your own code in card 1 with `PASTE-YOUR-CODE-HERE`** (the link copies the Shortcut as it is, including the code). Shortcut → **Share** → **Copy iCloud Link** → put it in `VITE_SHORTCUT_URL` (Vercel env). The app's "Add shortcut" button opens that link.

## Run it automatically (each player, 1 minute)

Shortcuts → **Automation** → **+** → **Time of Day** → `10:00`, Daily → **Run Immediately** → Next → **Run Shortcut: Invade Sync**. Repeat for **12:00, 14:00 and 15:30** (the final sync before judging). Players can also tap **Sync from Apple Health** in the app at any time.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Unknown code" | Card 1 still says PASTE-YOUR-CODE-HERE or has a typo: paste the code from the app's Connect screen |
| Steps show 0 | Health access denied: Settings → Health → Data Access → Shortcuts → turn on Steps |
| Number lower than Health app | Health hasn't written the latest steps yet (it batches every few minutes); sync again later |
