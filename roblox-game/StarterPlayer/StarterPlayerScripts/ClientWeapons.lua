-- ClientWeapons.lua
-- Path: StarterPlayer/StarterPlayerScripts/ClientWeapons.lua
-- Handles HUD (crosshair, ammo), local firing effects, and listens for server GameEvents

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

local GameEvents = RS:WaitForChild("GameEvent")
local ActionEvent = RS:WaitForChild("GameAction")

-- Create HUD
local playerGui = player:WaitForChild("PlayerGui")
local hudGui = Instance.new("ScreenGui")
hudGui.Name = "OpenFrontHUD"
hudGui.ResetOnSpawn = false
hudGui.Parent = playerGui

-- Crosshair
local cross = Instance.new("TextLabel")
cross.Name = "Crosshair"
cross.Size = UDim2.new(0,24,0,24)
cross.Position = UDim2.new(0.5,-12,0.5,-12)
cross.BackgroundTransparency = 1
cross.Text = "+"
cross.Font = Enum.Font.SourceSansBold
cross.TextSize = 24
cross.TextColor3 = Color3.new(1,1,1)
cross.Parent = hudGui

-- Ammo display
local ammoLabel = Instance.new("TextLabel")
ammoLabel.Name = "Ammo"
ammoLabel.Size = UDim2.new(0,120,0,28)
ammoLabel.Position = UDim2.new(1,-132,0,8)
ammoLabel.BackgroundTransparency = 0.4
ammoLabel.BackgroundColor3 = Color3.fromRGB(20,20,20)
ammoLabel.TextColor3 = Color3.new(1,1,1)
ammoLabel.Font = Enum.Font.SourceSans
ammoLabel.TextSize = 18
ammoLabel.Text = "Ammo: --"
ammoLabel.Parent = hudGui

-- Small notification label
local notify = Instance.new("TextLabel")
notify.Name = "Notify"
notify.Size = UDim2.new(0,360,0,36)
notify.Position = UDim2.new(0.5,-180,0.45,0)
notify.BackgroundTransparency = 1
notify.TextColor3 = Color3.new(1,0.8,0.2)
notify.Font = Enum.Font.SourceSansBold
notify.TextSize = 20
notify.Text = ""
notify.Visible = false
notify.Parent = hudGui

local function flashNotify(text, seconds)
    notify.Text = text
    notify.Visible = true
    delay(seconds or 1.2, function() notify.Visible = false end)
end

-- Handle server events for HUD updates and effects
GameEvents.OnClientEvent:Connect(function(action, data)
    if action == "shotFired" then
        -- update ammo
        local ammo = data.ammo
        ammoLabel.Text = string.format("Ammo: %d", ammo)
        -- small muzzle flash (scale crosshair briefly)
        local goal = {TextSize = 30}
        local tween = TweenService:Create(cross, TweenInfo.new(0.08, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), goal)
        tween:Play()
        tween.Completed:Wait()
        local back = TweenService:Create(cross, TweenInfo.new(0.12), {TextSize = 24})
        back:Play()
    elseif action == "reloadStart" then
        flashNotify("Reloading...", data.time)
    elseif action == "reloadComplete" then
        flashNotify("Reloaded", 1.0)
        ammoLabel.Text = string.format("Ammo: %d", data.ammo)
    elseif action == "noAmmo" then
        flashNotify("No ammo! Reload.", 1.5)
    elseif action == "hitConfirmed" then
        -- brief green flash
        local old = cross.TextColor3
        cross.TextColor3 = Color3.fromRGB(0,255,0)
        delay(0.14, function() cross.TextColor3 = old end)
    elseif action == "youWereHit" then
        -- brief red flash
        local old = cross.BackgroundColor3
        cross.BackgroundTransparency = 0.1
        cross.BackgroundColor3 = Color3.fromRGB(255,40,40)
        delay(0.18, function() cross.BackgroundTransparency = 1; cross.BackgroundColor3 = old end)
    elseif action == "explosion" then
        -- show explosion marker at screen position
        local pos = data.position
        local radius = data.radius or 8
        local screenPos, onScreen = camera:WorldToViewportPoint(pos)
        if onScreen then
            local mark = Instance.new("TextLabel")
            mark.Size = UDim2.new(0,80,0,36)
            mark.Position = UDim2.new(0,screenPos.X - 40,0,screenPos.Y - 18)
            mark.BackgroundTransparency = 0.5
            mark.BackgroundColor3 = Color3.fromRGB(255,120,40)
            mark.Text = "BOOM"
            mark.Font = Enum.Font.SourceSansBold
            mark.TextSize = 18
            mark.Parent = hudGui
            delay(0.8, function() if mark and mark.Parent then mark:Destroy() end end)
        end
    elseif action == "hitImpact" then
        local pos = data.position
        local screenPos, onScreen = camera:WorldToViewportPoint(pos)
        if onScreen then
            local dot = Instance.new("Frame")
            dot.Size = UDim2.new(0,10,0,10)
            dot.Position = UDim2.new(0,screenPos.X - 5,0,screenPos.Y - 5)
            dot.BackgroundColor3 = Color3.fromRGB(255,255,0)
            dot.BorderSizePixel = 0
            dot.Parent = hudGui
            delay(0.5, function() if dot and dot.Parent then dot:Destroy() end end)
        end
    end
end)

-- Fire handler: sends Fire action to server with origin and target
local mouse = player:GetMouse()
local equipped = "pistol"

mouse.Button1Down:Connect(function()
    local char = player.Character
    if not char or not char:FindFirstChild("HumanoidRootPart") then return end
    local origin = char.HumanoidRootPart.Position
    local target = mouse.Hit and mouse.Hit.p or (origin + camera.CFrame.LookVector * 100)
    ActionEvent:FireServer("fire", { origin = origin, target = target, weapon = equipped })
end)

-- Reload on R
local function onInputBegan(input, gameProcessed)
    if gameProcessed then return end
    if input.KeyCode == Enum.KeyCode.R then
        ActionEvent:FireServer("reload", { weapon = equipped })
    end
end

local UserInputService = game:GetService("UserInputService")
UserInputService.InputBegan:Connect(onInputBegan)

-- Keep HUD facing and basic updates
RunService.RenderStepped:Connect(function()
    -- optional: update ammo from player attribute if available
    local data = player:GetAttribute("_openfront_data")
    if data and data.equipped then equipped = data.equipped end
end)
