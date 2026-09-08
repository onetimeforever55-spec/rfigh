-- ClientSettingsModal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientSettingsModal.lua
-- Basic settings: graphics presets, sound volume stubs

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "SettingsModal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

gui.Enabled = true
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0,360,0,220)
frame.Position = UDim2.new(0.02,0,0.7,0)
frame.BackgroundColor3 = Color3.fromRGB(18,18,18)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,30)
title.Position = UDim2.new(0,0,0,4)
title.BackgroundTransparency = 1
title.Text = "Settings"
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(1,1,1)
title.Parent = frame

local gfxLabel = Instance.new("TextLabel")
gfxLabel.Size = UDim2.new(0,160,0,24)
gfxLabel.Position = UDim2.new(0,8,0,40)
gfxLabel.BackgroundTransparency = 1
gfxLabel.Text = "Graphics"
gfxLabel.TextColor3 = Color3.new(1,1,1)
gfxLabel.Parent = frame

local gfxDropdown = Instance.new("TextButton")
gfxDropdown.Size = UDim2.new(0,160,0,28)
gfxDropdown.Position = UDim2.new(0,180,0,40)
gfxDropdown.Text = "Balanced"
gfxDropdown.Parent = frame

gfxDropdown.MouseButton1Click:Connect(function()
    local options = {"Low","Balanced","High"}
    local current = gfxDropdown.Text
    local idx = 1
    for i,v in ipairs(options) do if v == current then idx = i break end end
    idx = idx % #options + 1
    gfxDropdown.Text = options[idx]
end)

print("SettingsModal ready")
