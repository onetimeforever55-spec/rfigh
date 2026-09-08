-- GameServer (Server)
-- Path: ServerScriptService/GameServer
-- Gestiona el ciclo de la partida: spawn, tiempo de partida, scoring y pickups

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local GameCore = require(ReplicatedStorage:WaitForChild("GameModules"):WaitForChild("GameCore"))
local Leaderboard = require(ReplicatedStorage:WaitForChild("GameModules"):WaitForChild("Leaderboard"))
local GameEvents = ReplicatedStorage:FindFirstChild("GameEvent") or Instance.new("RemoteEvent", ReplicatedStorage); GameEvents.Name = "GameEvent"

local activeMatches = {} -- id -> { players = {...}, endsAt = tick(), state = "running" }

local MATCH_DURATION = 180 -- seconds
local PICKUP_TAG = GameCore.PickupTag

local function bindPickupTouch(part)
    if not part then return end
    if not part:IsA("BasePart") then return end
    part.Touched:Connect(function(hit)
        local character = hit.Parent
        if character and character:FindFirstChild("Humanoid") then
            local player = Players:GetPlayerFromCharacter(character)
            if player then
                GameCore.OnPickupCollected(part, player)
                -- award points
                Leaderboard.AddScore(player, 10)
                GameEvents:FireClient(player, "pickupCollected", { id = part:GetAttribute("pickupId") })
            end
        end
    end)
end

-- attach pickup handlers on server start and when map created
local function setupPickupHandlers()
    local pickups = GameCore.GetPickups()
    for _,p in ipairs(pickups) do
        bindPickupTouch(p)
    end
end

setupPickupHandlers()

local GameServer = {}

-- Start a match with lobby info
function GameServer.StartMatch(id, lobby)
    if activeMatches[id] then return end
    local players = lobby.players or {}
    -- set up leaderboards for players
    for _,p in ipairs(players) do
        Leaderboard.SetupPlayer(p)
    end

    GameCore.CreateMap()
    GameCore.SpawnPlayers(players)

    local match = {
        players = players,
        endsAt = tick() + MATCH_DURATION,
        state = "running"
    }
    activeMatches[id] = match

    -- notify players periodically and end after duration
    spawn(function()
        while activeMatches[id] and activeMatches[id].state == "running" and tick() < activeMatches[id].endsAt do
            wait(1)
        end
        if activeMatches[id] then
            GameServer.EndMatch(id)
        end
    end)
end

function GameServer.EndMatch(id)
    local match = activeMatches[id]
    if not match then return end
    -- compute winner
    local winner
    local high = -math.huge
    for _,p in ipairs(match.players) do
        local score = 0
        if p and p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("Score") then
            score = p.leaderstats.Score.Value
        end
        if score > high then high = score; winner = p end
    end
    -- notify clients
    for _,p in ipairs(match.players) do
        if p and p.Parent then
            GameEvents:FireClient(p, "matchEnded", { winner = (winner and winner.Name) or "None" })
            p:SetAttribute("lobbyId", nil)
        end
    end
    activeMatches[id] = nil
end

return GameServer
