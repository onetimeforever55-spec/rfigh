-- GameCore (ModuleScript)
-- Path intended for Roblox: ReplicatedStorage/GameModules/GameCore
-- Funciones: crear mapa mínimo, spawn players, gestionar pickups básicos

local GameCore = {}
local Workspace = game:GetService("Workspace")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")

-- Settings
GameCore.MapName = "OpenFrontMap"
GameCore.PickupTag = "OpenFrontPickup"
GameCore.PickupRespawnTime = 20

-- Ensure map exists (creates minimal map model if absent)
function GameCore.CreateMap()
    if Workspace:FindFirstChild(GameCore.MapName) then return Workspace[GameCore.MapName] end

    local map = Instance.new("Model")
    map.Name = GameCore.MapName
    map.Parent = Workspace

    local base = Instance.new("Part")
    base.Name = "Base"
    base.Size = Vector3.new(200, 2, 200)
    base.Position = Vector3.new(0, 0, 0)
    base.Anchored = true
    base.BrickColor = BrickColor.new("Institutional white")
    base.Parent = map

    -- spawn points
    for i = 1, 8 do
        local sp = Instance.new("Part")
        sp.Name = "Spawn"..i
        sp.Size = Vector3.new(6,1,6)
        sp.Position = Vector3.new(math.cos(i) * 30, 4, math.sin(i) * 30)
        sp.Anchored = true
        sp.BrickColor = BrickColor.new("Bright green")
        sp.Parent = map
    end

    -- create a few pickups
    for i = 1, 6 do
        local pickup = Instance.new("Part")
        pickup.Name = "Pickup_"..i
        pickup.Size = Vector3.new(2,2,2)
        pickup.Position = Vector3.new((i*20-60), 3, 0)
        pickup.Anchored = true
        pickup.BrickColor = BrickColor.new("Bright yellow")
        pickup.Parent = map
        CollectionService:AddTag(pickup, GameCore.PickupTag)
        pickup:SetAttribute("pickupId", "pickup_"..i)
    end

    return map
end

-- Returns spawn positions (Parts)
function GameCore.GetSpawns()
    local map = GameCore.CreateMap()
    local spawns = {}
    for _,v in ipairs(map:GetChildren()) do
        if v.Name:match("^Spawn") then
            table.insert(spawns, v)
        end
    end
    return spawns
end

-- Positions characters to spawn points (simple round-robin)
function GameCore.SpawnPlayers(playerList)
    local spawns = GameCore.GetSpawns()
    if #spawns == 0 then return end
    for i,player in ipairs(playerList) do
        if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then
            local spawn = spawns[((i-1) % #spawns) + 1]
            player.Character:SetPrimaryPartCFrame(CFrame.new(spawn.Position + Vector3.new(0,3,0)))
        else
            player.CharacterAdded:Wait()
            if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then
                local spawn = spawns[((i-1) % #spawns) + 1]
                player.Character:SetPrimaryPartCFrame(CFrame.new(spawn.Position + Vector3.new(0,3,0)))
            end
        end
    end
end

-- Utility to find pickups in map
function GameCore.GetPickups()
    local pickups = {}
    local map = GameCore.CreateMap()
    for _,v in ipairs(map:GetDescendants()) do
        if v:IsA("BasePart") and CollectionService:HasTag(v, GameCore.PickupTag) then
            table.insert(pickups, v)
        end
    end
    return pickups
end

-- Handle pickup "collected" logic: server should call this when a player collects a pickup
function GameCore.OnPickupCollected(pickupPart, player, onRespawn)
    -- mark invisible, then respawn after time
    if not pickupPart or not pickupPart.Parent then return end
    pickupPart.Transparency = 1
    pickupPart.CanCollide = false
    pickupPart:SetAttribute("lastCollectedBy", player.UserId)
    -- schedule respawn
    delay(GameCore.PickupRespawnTime, function()
        if pickupPart and pickupPart.Parent then
            pickupPart.Transparency = 0
            pickupPart.CanCollide = true
            if onRespawn then pcall(onRespawn, pickupPart) end
        end
    end)
end

return GameCore
