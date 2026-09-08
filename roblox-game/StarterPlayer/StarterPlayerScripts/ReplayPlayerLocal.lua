-- ReplayPlayerLocal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ReplayPlayerLocal.lua
-- Adds a small UI to fetch and play replays for the current match or history

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local MatchRequest = ReplicatedStorage:FindFirstChild("MatchRequest")

local gui = Instance.new("ScreenGui")
gui.Name = "ReplayPlayerLocal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local btn = Instance.new("TextButton")
btn.Size = UDim2.new(0,140,0,28)
btn.Position = UDim2.new(0.5,-70,0.9,0)
btn.Text = "Play Last Replay"
btn.Parent = gui

btn.MouseButton1Click:Connect(function()
    if not MatchRequest then
        btn.Text = "Not available"
        delay(1.4, function() btn.Text = "Play Last Replay" end)
        return
    end
    local ok, data = pcall(function() return MatchRequest:InvokeServer("last") end)
    if ok and data then
        local runner = require(script.Parent:WaitForChild("ClientGameRunner"))
        runner.PlayReplay(data)
    else
        btn.Text = "Failed"
        delay(1.4, function() btn.Text = "Play Last Replay" end)
    end
end)

print("ReplayPlayerLocal ready")
