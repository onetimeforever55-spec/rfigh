-- Matchmaking (Server)
-- Path: ServerScriptService/Matchmaking
-- Gestiona lobbies: host, list, join, leave, start. Usa RemoteEvent LobbyEvent.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local LobbyEvent = ReplicatedStorage:FindFirstChild("LobbyEvent") or Instance.new("RemoteEvent", ReplicatedStorage); LobbyEvent.Name = "LobbyEvent"
local GameServer = script.Parent:FindFirstChild("GameServer") -- optional
local nextLobbyId = 0

local lobbies = {} -- lobbyId -> { host = player, players = {player}, capacity = n, status = "open"|"running" }

local function broadcastLobbyList()
    local summary = {}
    for id, lb in pairs(lobbies) do
        summary[id] = { host = lb.host.Name, count = #lb.players, capacity = lb.capacity, status = lb.status }
    end
    LobbyEvent:FireAllClients("lobbyList", summary)
end

LobbyEvent.OnServerEvent:Connect(function(player, action, data)
    if action == "host" then
        nextLobbyId = nextLobbyId + 1
        local id = tostring(player.UserId) .. "_" .. tostring(nextLobbyId)
        lobbies[id] = { host = player, players = {player}, capacity = (data and data.capacity) or 8, status = "open" }
        player:SetAttribute("lobbyId", id)
        LobbyEvent:FireClient(player, "hostCreated", { id = id })
        broadcastLobbyList()
    elseif action == "list" then
        broadcastLobbyList()
    elseif action == "join" then
        local id = data and data.id
        local lb = id and lobbies[id]
        if not lb then
            LobbyEvent:FireClient(player, "error", "Lobby no encontrado")
            return
        end
        if lb.status ~= "open" then
            LobbyEvent:FireClient(player, "error", "Lobby ya en partida")
            return
        end
        if #lb.players >= lb.capacity then
            LobbyEvent:FireClient(player, "error", "Lobby lleno")
            return
        end
        table.insert(lb.players, player)
        player:SetAttribute("lobbyId", id)
        LobbyEvent:FireAllClients("playerJoinedLobby", { id = id, player = player.Name })
        broadcastLobbyList()
    elseif action == "leave" then
        local id = player:GetAttribute("lobbyId")
        if id and lobbies[id] then
            local lb = lobbies[id]
            for i, p in ipairs(lb.players) do if p == player then table.remove(lb.players, i); break end end
            player:SetAttribute("lobbyId", nil)
            if #lb.players == 0 then lobbies[id] = nil end
            broadcastLobbyList()
        end
    elseif action == "start" then
        local id = player:GetAttribute("lobbyId")
        local lb = id and lobbies[id]
        if lb and lb.host == player and lb.status == "open" then
            lb.status = "running"
            -- Notify clients
            LobbyEvent:FireAllClients("matchStarting", { id = id })
            -- hand off to GameServer
            if script:FindFirstChild("GameServer") then
                local gameServer = require(script.GameServer)
                gameServer.StartMatch(id, lb)
            else
                -- minimal logic: spawn players via GameModules
                local gameModules = ReplicatedStorage:WaitForChild("GameModules")
                local GameCore = require(gameModules:WaitForChild("GameCore"))
                GameCore.SpawnPlayers(lb.players)
            end
            broadcastLobbyList()
        end
    end
end)

Players.PlayerRemoving:Connect(function(plr)
    local id = plr:GetAttribute("lobbyId")
    if id and lobbies[id] then
        local lb = lobbies[id]
        for i,p in ipairs(lb.players) do if p == plr then table.remove(lb.players, i); break end end
        if #lb.players == 0 then lobbies[id] = nil end
        broadcastLobbyList()
    end
end)
