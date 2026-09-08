# OpenFront → Roblox

This repository folder contains a full conversion scaffold of the OpenFront web frontend into a playable Roblox game. It is intended to be a starting point — you'll need to upload your own assets and polish gameplay.

IMPORTANT:
- The original OpenFront project is AGPLv3-licensed; this conversion preserves the required attribution text "© OpenFront and Contributors" in the main menus and README. If you publish a networked service based on this code, AGPL obligations require you to make the modified source available.
- Files under the original repo's proprietary/ directory are NOT included. Replace proprietary assets with your own Roblox uploads (use rbxassetid:// IDs).

Contents of this folder (roblox-game):
- ReplicatedStorage/GameModules/GameCore.lua
- ReplicatedStorage/GameModules/Leaderboard.lua
- ServerScriptService/Matchmaking.lua
- ServerScriptService/GameServer.lua
- StarterPlayer/StarterPlayerScripts/ClientUI.lua
- Plugin/OpenFrontToRobloxPlugin.lua
- README_installation.txt
- NOTICE_LICENSE.txt

How to use:
1) In your repository, download this folder or clone the repo.
2) Open Roblox Studio, create a new Place.
3) Add the files to the corresponding locations in Explorer (or run the provided plugin to scaffold the structure).
4) Upload any images/sounds/models you need and replace placeholders in the UI scripts.
5) Test with Start Server + multiple Players.

If you want, I can also prepare a ZIP release on this repo and add a GitHub Action that packages the roblox-game folder into a downloadable ZIP automatically.
