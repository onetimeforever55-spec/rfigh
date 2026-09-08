-- ClientGameStatsModal.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientGameStatsModal.lua
-- Shows last match stats from ServerStorage.OpenFrontReplays metadata (simple)

local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "GameStatsModal"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

gui.Enabled = true
local frame = Instance.new("Frame")
frame.Size = UDim2.new(0,420,0,240)
frame.Position = UDim2.new(0.02,0,0.5,0)
frame.BackgroundColor3 = Color3.fromRGB(18,18,18)
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,30)
title.Position = UDim2.new(0,0,0,4)
title.BackgroundTransparency = 1
title.Text = "Match Stats"
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(1,1,1)
title.Parent = frame

local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(1,-16,1,-40)
list.Position = UDim2.new(0,8,0,36)
list.CanvasSize = UDim2.new(0,0,0,0)
list.BackgroundTransparency = 0.9
list.Parent = frame

local function refresh()
    for _,c in ipairs(list:GetChildren()) do c:Destroy() end
    local folder = ServerStorage:FindFirstChild("OpenFrontReplays")
    if not folder then
        local lbl = Instance.new("TextLabel")
        lbl.Size = UDim2.new(1,-8,0,24)
        lbl.Position = UDim2.new(0,4,0,0)
        lbl.BackgroundTransparency = 1
        lbl.Text = "No replays available"
        lbl.TextColor3 = Color3.new(1,1,1)
        lbl.Parent = list
        list.CanvasSize = UDim2.new(0,0,0,28)
        return
    end
    local y = 0
    for _,sv in ipairs(folder:GetChildren()) do
        if sv:IsA("StringValue") then
            local lbl = Instance.new("TextButton")
            lbl.Size = UDim2.new(1,-8,0,28)
            lbl.Position = UDim2.new(0,4,0,y)
            lbl.Text = sv.Name
            lbl.Parent = list
            lbl.MouseButton1Click:Connect(function()
                -- request replay metadata via RemoteFunction (if implemented) or read from ServerStorage
                local ok, data = pcall(function() return game:GetService("HttpService"):JSONDecode(sv.Value) end)
                if ok then
                    -- play a client-side summary overlay or use ClientGameRunner.PlayReplay
                    local runner = require(script.Parent:WaitForChild("ClientGameRunner"))
                    runner.PlayReplay(data)
                end
            end)
            y = y + 32
        end
    end
    list.CanvasSize = UDim2.new(0,0,0,y)
end

refresh()

print("GameStatsModal ready")
