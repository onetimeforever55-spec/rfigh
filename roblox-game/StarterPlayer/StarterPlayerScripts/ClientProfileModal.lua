-- ClientProfileModal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientProfileModal.lua
-- Shows player's profile, basic stats and allow change username (writes to attribute or remote call)

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "ProfileModal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

gui.Enabled = true
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0,360,0,260)
frame.Position = UDim2.new(0.5,-180,0.12,0)
frame.BackgroundColor3 = Color3.fromRGB(18,18,18)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,30)
title.Position = UDim2.new(0,0,0,4)
title.BackgroundTransparency = 1
title.Text = "Profile"
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(1,1,1)
title.Parent = frame

local statsLabel = Instance.new("TextLabel")
statsLabel.Size = UDim2.new(1,-16,0,180)
statsLabel.Position = UDim2.new(0,8,0,40)
statsLabel.BackgroundTransparency = 1
statsLabel.TextColor3 = Color3.new(1,1,1)
statsLabel.TextWrapped = true
statsLabel.Font = Enum.Font.SourceSans
statsLabel.TextSize = 14
statsLabel.Text = "Loading..."
statsLabel.Parent = frame

local function refresh()
    local data = player:GetAttribute("_openfront_data") or {}
    local s = {}
    s[#s+1] = "Name: "..player.Name
    s[#s+1] = "Score: "..tostring((player.leaderstats and player.leaderstats.Score and player.leaderstats.Score.Value) or 0)
    s[#s+1] = "Kills: "..tostring((player.leaderstats and player.leaderstats.Kills and player.leaderstats.Kills.Value) or 0)
    s[#s+1] = "Inventory: " .. (table.concat(data.inventory or {}, ", ") or "—")
    statsLabel.Text = table.concat(s, "\n")
end

refresh()
player:GetAttributeChangedSignal("_openfront_data"):Connect(refresh)

print("ProfileModal ready")
