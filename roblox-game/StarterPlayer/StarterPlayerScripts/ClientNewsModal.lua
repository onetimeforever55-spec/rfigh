-- ClientNewsModal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientNewsModal.lua
-- Simple news modal pulling text from ReplicatedStorage.News (StringValue) or static content

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local newsValue = ReplicatedStorage:FindFirstChild("OpenFrontNews")

local gui = Instance.new("ScreenGui")
gui.Name = "NewsModal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

gui.Enabled = true
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0,520,0,240)
frame.Position = UDim2.new(0.5,-260,0.12,0)
frame.BackgroundColor3 = Color3.fromRGB(18,18,18)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,36)
title.Position = UDim2.new(0,0,0,4)
title.BackgroundTransparency = 1
title.Text = "News"
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(1,1,1)
title.Parent = frame

local body = Instance.new("TextLabel")
body.Size = UDim2.new(1,-16,1,-48)
body.Position = UDim2.new(0,8,0,48)
body.BackgroundTransparency = 1
body.TextColor3 = Color3.new(1,1,1)
body.TextWrapped = true
body.Font = Enum.Font.SourceSans
body.TextSize = 14
body.Text = newsValue and newsValue.Value or "Welcome to OpenFront on Roblox. News will appear here."
body.Parent = frame

print("NewsModal ready")
