-- ClientHelpModal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientHelpModal.lua
-- Provides help text and basic troubleshooting instructions

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "HelpModal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

gui.Enabled = true
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0,480,0,320)
frame.Position = UDim2.new(0.5,-240,0.12,0)
frame.BackgroundColor3 = Color3.fromRGB(18,18,18)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,36)
title.Position = UDim2.new(0,0,0,4)
title.BackgroundTransparency = 1
title.Text = "Help & Troubleshooting"
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(1,1,1)
title.Parent = frame

local rich = Instance.new("TextLabel")
rich.Size = UDim2.new(1,-16,1,-48)
rich.Position = UDim2.new(0,8,0,48)
rich.BackgroundTransparency = 1
rich.TextColor3 = Color3.new(1,1,1)
rich.TextWrapped = true
rich.Font = Enum.Font.SourceSans
rich.TextSize = 14
rich.Text = [[Controls:
- Left click to fire
- R to reload

Troubleshooting:
- If you see rubber-banding, check your network.
- If HUD doesn't update, rejoin the server.

Contact support with your PlayerId if issues persist.]]
rich.Parent = frame

print("HelpModal ready")
