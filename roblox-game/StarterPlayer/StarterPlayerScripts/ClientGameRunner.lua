-- ClientGameRunner.lua (expanded)
-- Path: StarterPlayer/StarterPlayerScripts/ClientGameRunner.lua
-- Handles local entity tracking, match events, simple client-side prediction, and replay playback integration

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer

local GameEvent = ReplicatedStorage:WaitForChild("GameEvent")
local ReplayEvent = ReplicatedStorage:WaitForChild("ReplayEvent")
local MatchRequest = ReplicatedStorage:FindFirstChild("MatchRequest")

local ClientGameRunner = {}

-- local state
local running = false
local matchInfo = nil
local entities = {} -- userId -> { characterRef, lastKnownPos }

function ClientGameRunner.Init(p, rs)
    player = p or player
end

function ClientGameRunner.OnMatchStart(data)
    matchInfo = data
    running = true
    entities = {}
    -- create ephemeral overlays; prepare HUD
    print("ClientGameRunner: match started", data.id, data.mode)
end

function ClientGameRunner.OnMatchEnd(data)
    running = false
    matchInfo = nil
    entities = {}
    print("ClientGameRunner: match ended", data.id, data.winner)
end

-- Track other players' characters as entities
local function registerCharacter(char)
    local owner = Players:GetPlayerFromCharacter(char)
    if owner then
        entities[owner.UserId] = { character = char, root = char:FindFirstChild("HumanoidRootPart") }
    end
end

Players.PlayerAdded:Connect(function(plr)
    if plr.Character then registerCharacter(plr.Character) end
    plr.CharacterAdded:Connect(function(char) registerCharacter(char) end)
end)

for _,plr in ipairs(Players:GetPlayers()) do
    if plr.Character then registerCharacter(plr.Character) end
    plr.CharacterAdded:Connect(function(char) registerCharacter(char) end)
end

-- Listen to game events to show local feedback
GameEvent.OnClientEvent:Connect(function(action, data)
    if action == "pickupCollected" then
        -- animate pickup UI if owned
    elseif action == "matchStarted" then
        -- handled above
    elseif action == "matchEnded" then
        -- handled above
    elseif action == "shotFired" then
        -- local effects handled in ClientVFX
    elseif action == "hitImpact" then
        -- optionally show world marker
    end
end)

-- Simple replay request helper (invokes RemoteFunction)
function ClientGameRunner.RequestReplay(matchId)
    if not MatchRequest then warn("MatchRequest RemoteFunction missing") return nil end
    local ok, data = pcall(function() return MatchRequest:InvokeServer(matchId) end)
    if ok then return data end
    return nil
end

-- Basic replay player: consumes replay data object and animates simple overlay and camera movements
function ClientGameRunner.PlayReplay(replay)
    if not replay or not replay.events then return end
    -- create overlay
    local playerGui = player:WaitForChild("PlayerGui")
    local overlay = Instance.new("ScreenGui")
    overlay.Name = "ReplayOverlay"
    overlay.ResetOnSpawn = false
    overlay.Parent = playerGui

    local panel = Instance.new("Frame")
    panel.Size = UDim2.new(0,520,0,140)
    panel.Position = UDim2.new(0.5,-260,0.05,0)
    panel.BackgroundTransparency = 0.25
    panel.BackgroundColor3 = Color3.fromRGB(12,12,12)
    panel.Parent = overlay

    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(1,-12,1,-12)
    label.Position = UDim2.new(0,6,0,6)
    label.BackgroundTransparency = 1
    label.TextColor3 = Color3.new(1,1,1)
    label.Font = Enum.Font.SourceSans
    label.TextSize = 14
    label.TextWrapped = true
    label.Text = ""
    label.Parent = panel

    -- simple sequential playback with time scaling for brevity
    local events = replay.events
    spawn(function()
        local lastT = 0
        for i,ev in ipairs(events) do
            local t = ev.timestamp or 0
            local dt = math.max(0, (t - lastT) * 0.25)
            wait(dt)
            lastT = t
            label.Text = string.format("[%0.2f] %s: %s", ev.timestamp or 0, ev.type, tostring(ev.payload and ev.payload.summary or ev.payload and ev.payload.weapon or ""))
            -- optional: show temporary world markers for positions
            if ev.payload and ev.payload.pos then
                local pos = ev.payload.pos
                local marker = Instance.new("Part")
                marker.Size = Vector3.new(1,1,1)
                marker.CFrame = CFrame.new(pos)
                marker.Anchored = true
                marker.CanCollide = false
                marker.Transparency = 0.3
                marker.BrickColor = BrickColor.new("Bright yellow")
                marker.Parent = workspace
                game:GetService("Debris"):AddItem(marker, 1.2)
            end
        end
        wait(1.8)
        overlay:Destroy()
    end)
end

RunService.Heartbeat:Connect(function(dt)
    if not running then return end
    -- per-frame client-side updates if needed (interpolation, camera smoothing, etc.)
end)

return ClientGameRunner
