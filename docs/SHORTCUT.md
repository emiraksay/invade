# "Invade Sync" iOS Shortcut

Web apps can't read Apple Health. A Shortcut can, so this one bridges Health to our server. **Build it once** (Emir, ~10 min), share the iCloud link, and every player installs that same Shortcut. It holds no personal data: on the first run it asks for the player's private code and stores it on their phone.

What it sends: **today's step total only** → `POST /api/steps { token, steps, day }`. The server keeps the highest total per day, so running it any number of times is safe.

## Build it (Shortcuts app → **+**)

Name it exactly **`Invade Sync`** (the app's Sync button opens it by this name).

| # | Action (search for it) | Settings |
|---|---|---|
| 1 | **Get File** | Turn off "Show Document Picker"; File Path: `invade-code.txt`; turn off "Error If Not Found" |
| 2 | **If** | Input: *File* · Condition: **does not have any value** |
| 3 |   ↳ **Ask for Input** | Type: Text · Prompt: `Paste your Invade code` |
| 4 |   ↳ **Save File** | Input: *Provided Input* · turn off "Ask Where to Save" · Subpath: `invade-code.txt` · **Overwrite** on |
| 5 | **End If** | |
| 6 | **Get File** | Same as step 1 (now it always exists) |
| 7 | **Set Variable** | Name: `Code` · Input: *File* |
| 8 | **Find Health Samples** | Type: **Steps** · Start Date **is today** · Group By: **Day** (see the Apple Watch note) |
| 9 | **Calculate Statistics** | **Sum** of *Health Samples* |
| 10 | **Set Variable** | Name: `Steps` · Input: *Statistics Result* |
| 11 | **Format Date** | Date: *Current Date* · Format: Custom · `yyyy-MM-dd` |
| 12 | **Get Contents of URL** | URL: `https://<our-app>.vercel.app/api/steps` · Method: **POST** · Request Body: **JSON** with `token` (Text) = *Code*, `steps` (Number) = *Steps*, `day` (Text) = *Formatted Date* |
| 13 | **Get Dictionary Value** | Get value for key `data` in *Contents of URL* |
| 14 | **Get Dictionary Value** | Get value for key `steps` in *Dictionary Value* |
| 15 | **Show Notification** | `Invade: ` *Dictionary Value* ` steps synced ⚔` |

The first run asks for **Health access**: allow **Steps**.

### Apple Watch note (the double counting check)

Health stores steps from both the iPhone and the Watch, and adding up the raw records can count some steps twice. **Group By: Day** in step 8 makes Health return its own de-duplicated daily total. **Verify:** after syncing, compare the notification's number with Health app → Steps → Today. If they differ (only possible for Watch owners), change step 8 to filter **Source is <this iPhone's name>** and remove Group By.

## Share it

Shortcut → **⋯** → **Share** → **Copy iCloud Link** → put it in `VITE_SHORTCUT_URL` (Vercel env). The app's "Add shortcut" button opens that link.

## Run it automatically (each player, 1 minute)

Shortcuts → **Automation** → **+** → **Time of Day** → `10:00`, Daily → **Run Immediately** → Next → **Run Shortcut: Invade Sync**. Repeat for **12:00, 14:00 and 15:30** (the final sync before judging). Players can also tap **Sync from Apple Health** in the app at any time.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Unknown code" | Wrong code saved: delete `invade-code.txt` (Files → Shortcuts) and run again |
| Steps show 0 | Health access denied: Settings → Health → Data Access → Shortcuts → turn on Steps |
| Number lower than Health app | Health hasn't written the latest steps yet (it batches every few minutes); sync again later |
