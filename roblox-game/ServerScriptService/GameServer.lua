-- Enhanced GameServer (Server)
-- Replaces earlier GameServer to add combat handling and purchase hooks

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")

-- Require modules
local RSmodules = ReplicatedStorage:WaitForChild("GameModules")
local GameCore = require(RSmodules:WaitForChild("GameCore"))
local Leaderboard = require(RSmodules:WaitForChild("Leaderboard"))
local Weapon = require(RSmodules:WaitForChild("Weapon"))
local DataStoreModule = require(RSmodules:WaitForChild("DataStoreModule"))
local Shop = require(RSmodules:WaitForChild("Shop"))

-- Remote events
local GameEvents = ReplicatedStorage:FindFirstChild("GameEvent") or Instance.new("RemoteEvent", ReplicatedStorage); GameEvents.Name = "GameEvent"
local ActionEvent = ReplicatedStorage:FindFirstChild("GameAction") or Instance.new("RemoteEvent", ReplicatedStorage); ActionEvent.Name = "GameAction"

local MATCH_DURATION = 180 -- seconds
local activeMatches = {}

local function validateAndApplyHit(shooter, originPos, direction, range, weaponCfg)
    local rayParams = RaycastParams.new()
    rayParams.FilterType = Enum.RaycastFilterType.Blacklist
    -- don't hit shooter's character
    if shooter.Character then
        rayParams.FilterDescendantsInstances = { shooter.Character }
    end
    local result = workspace:Raycast(originPos, direction.Unit * range, rayParams)
    if result and result.Instance then
        local part = result.Instance
        local hitChar = part:FindFirstAncestorOfClass("Model")
        if hitChar and hitChar:FindFirstChild("Humanoid") then
            local victim = Players:GetPlayerFromCharacter(hitChar)
            if victim and victim ~= shooter then
                -- apply damage
                local humanoid = hitChar:FindFirstChild("Humanoid")
                if humanoid and humanoid.Health > 0 then
                    humanoid:TakeDamage(weaponCfg.damage)
                    -- if killed, award kill and score
                    if humanoid.Health - weaponCfg.damage <= 0 then
                        Leaderboard.AddKill(shooter,1)
                        Leaderboard.AddScore(shooter,100)
                    else
                        Leaderboard.AddScore(shooter,10)
                    end
                    return { hit=true, victim=victim }
                end
            end
        end
    end
    return { hit=false }
end

-- Bind server-side handler for fire actions
ActionEvent.OnServerEvent:Connect(function(player, action, payload)
    if action == "fire" then
        -- payload: { origin = Vector3, target = Vector3, weapon = "pistol" }
        if not payload or type(payload) ~= "table" then return end
        local weaponName = payload.weapon or "pistol"
        local cfg = Weapon.Get(weaponName)
        if not cfg then return end
        -- validate positions are Vector3
        local origin = payload.origin
        local target = payload.target
        if typeof(origin) ~= "Vector3" or typeof(target) ~= "Vector3" then return end
        local direction = target - origin
        -- basic anti-cheat: check distance between origin and player's root
        local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
        if not root then return end
        if (root.Position - origin).Magnitude > 5 then
            -- origin too far from player
            return
        end
        local res = validateAndApplyHit(player, origin, direction, cfg.range, cfg)
        if res.hit then
            -- notify shooter and victim
            GameEvents:FireClient(player, "hitConfirmed", { victim = res.victim.Name, weapon = weaponName })
            GameEvents:FireClient(res.victim, "youWereHit", { by = player.Name, weapon = weaponName })
        end
    end
end)

-- Marketplace purchase handling (DevProducts)
local function processReceipt(receiptInfo)
    local playerId = receiptInfo.PlayerId
    local productId = receiptInfo.ProductId
    local player = Players:GetPlayerByUserId(playerId)
    if player then
        -- grant item according to Shop mapping
        local ok = Shop.GrantProductToPlayer(player, productId)
        if ok then
            -- update attribute for persistence
            local data = player:GetAttribute("_openfront_data") or DataStoreModule.Load(player)
            DataStoreModule.Save(player, data)
        end
    else
        -- player not online, still grant via DataStore later or skip
    end
    return Enum.ProductPurchaseDecision.PurchaseGranted
end

MarketplaceService.ProcessReceipt = processReceipt

-- Match lifecycle (keep previous implementation)
function StartMatch(id, lobby)
    if activeMatches[id] then return end
    local players = lobby.players or {}
    for _,p in ipairs(players) do
        Leaderboard.SetupPlayer(p)
        -- load data into player attribute for quick access
        local data = DataStoreModule.Load(p)
        p:SetAttribute("_openfront_data", data)
    end
    GameCore.CreateMap()
    GameCore.SpawnPlayers(players)
    activeMatches[id] = { players = players, endsAt = tick() + MATCH_DURATION }
    spawn(function()
        while activeMatches[id] and tick() < activeMatches[id].endsAt do wait(1) end
        if activeMatches[id] then
            -- compute winner
            local winner
            local high = -math.huge
            for _,p in ipairs(activeMatches[id].players) do
                local sc = 0
                if p and p:FindFirstChild("leaderstats") and p.leaderstats:FindFirstChild("Score") then
                    sc = p.leaderstats.Score.Value
                end
                if sc > high then high = sc; winner = p end
            end
            for _,p in ipairs(activeMatches[id].players) do
                if p and p.Parent then
                    GameEvents:FireClient(p, "matchEnded", { winner = (winner and winner.Name) or "None" })
                    -- persist player data
                    local data = p:GetAttribute("_openfront_data")
                    if data then DataStoreModule.Save(p, data) end
                    p:SetAttribute("lobbyId", nil)
                end
            end
            activeMatches[id] = nil
        end
    end)
end

return {
    StartMatch = StartMatch
}
