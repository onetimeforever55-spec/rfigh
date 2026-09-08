-- Plugin: OpenFront -> Roblox scaffold
-- Pegar este archivo como un PluginScript en la carpeta Plugins de Roblox Studio.
-- Al pulsar el botón se creará la estructura del juego (RemoteEvents, scripts, GUI).
local toolbar = plugin:CreateToolbar("OpenFront→Roblox")
local button = toolbar:CreateButton("Create OpenFront Game", "Crear scaffold del juego OpenFront convertido", "")

local function makeInstance(parent, className, name)
    local obj = Instance.new(className)
    obj.Name = name
    obj.Parent = parent
    return obj
end

local function createScaffold()
    local rs = game:GetService("ReplicatedStorage")
    local sss = game:GetService("ServerScriptService")
    local players = game:GetService("Players")
    local starterPlayer = game:GetService("StarterPlayer")
    local starterGui = game:GetService("StarterGui")
    local workspace = game:GetService("Workspace")

    -- ReplicatedStorage: RemoteEvent + Modules folder
    local remote = rs:FindFirstChild("LobbyEvent")
    if not remote then
        remote = makeInstance(rs, "RemoteEvent", "LobbyEvent")
    end

    local modulesFolder = rs:FindFirstChild("GameModules")
    if not modulesFolder then
        modulesFolder = makeInstance(rs, "Folder", "GameModules")
    end

    -- ModuleScript: GameCore
    if not modulesFolder:FindFirstChild("GameCore") then
        local ms = makeInstance(modulesFolder, "ModuleScript", "GameCore")
        ms.Source = [[
-- GameCore: funciones de juego (mapa simple, spawn y start)
local GameCore = {}

local Workspace = game:GetService("Workspace")
local Teams = game:GetService("Teams")

-- Crea un map mínimo (Box platform); reemplaza por import de mapa si tienes assets
function GameCore.CreateMap()
    if Workspace:FindFirstChild("OpenFrontMap") then return end
    local map = Instance.new("Model")
    map.Name = "OpenFrontMap"
    map.Parent = Workspace

    local base = Instance.new("Part")
    base.Name = "Base"
    base.Size = Vector3.new(200, 2, 200)
    base.Position = Vector3.new(0, 0, 0)
    base.Anchored = true
    base.TopSurface = Enum.SurfaceType.Smooth
    base.Parent = map

    -- spawn points
    for i=1,8 do
        local sp = Instance.new("SpawnLocation")
        sp.Name = "Spawn"..i
        sp.Size = Vector3.new(6,1,6)
        sp.Position = Vector3.new(math.cos(i)*30, 4, math.sin(i)*30)
        sp.Anchored = true
        sp.Parent = map
    end

    -- create a few pickups
    for i = 1, 6 do
        local pickup = Instance.new("Part")
        pickup.Name = "Pickup_"..i
        pickup.Size = Vector3.new(2,2,2)
        pickup.Position = Vector3.new((i*20-60), 3, 0)
        pickup.Anchored = true
        pickup.Parent = map
    end
end

-- Asigna players a spawnpoints y configura equipo básico
function GameCore.SpawnPlayers(players)
    GameCore.CreateMap()
    local map = Workspace:FindFirstChild("OpenFrontMap")
    if not map then return end

    local spawns = {}
    for _,v in pairs(map:GetChildren()) do
        if v:IsA("SpawnLocation") then table.insert(spawns, v) end
    end

    for i,plr in ipairs(players) do
        local char = plr.Character or plr.CharacterAdded:Wait()
        local spawn = spawns[((i-1) % #spawns) + 1]
        if char and char:FindFirstChild("HumanoidRootPart") then
            char:SetPrimaryPartCFrame(CFrame.new(spawn.Position + Vector3.new(0,3,0)))
        end
    end
end

-- Inicia la partida (simple)
function GameCore.StartMatch(lobby)
    if not lobby then return end
    local players = lobby.players or {}
    GameCore.SpawnPlayers(players)
end

return GameCore
        ]]
    end

    -- ServerScript: Matchmaking
    if not sss:FindFirstChild("Matchmaking") then
        local script = makeInstance(sss, "Script", "Matchmaking")
        script.Source = [[
-- Matchmaking server script
local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local LobbyEvent = RS:WaitForChild("LobbyEvent")
local GameCore = require(RS:WaitForChild("GameModules"):WaitForChild("GameCore"))

local lobbies = {} -- { lobbyId = { host = player, players = {player}, capacity = n } }

local function broadcastLobbyUpdate()
    local summary = {}
    for id,lb in pairs(lobbies) do
        summary[id] = { host = lb.host.Name, count = #lb.players, capacity = lb.capacity }
    end
    LobbyEvent:FireAllClients("lobbyList", summary)
end

LobbyEvent.OnServerEvent:Connect(function(player, action, data)
    -- actions: host, join, leave, list, start
    if action == "host" then
        local id = tostring(player.UserId).."_"..tostring(os.time())
        lobbies[id] = { host = player, players = {player}, capacity = data and data.capacity or 8 }
        player:SetAttribute("lobbyId", id)
        broadcastLobbyUpdate()
    elseif action == "list" then
        local summary = {}
        for id,lb in pairs(lobbies) do
            summary[id] = { host = lb.host.Name, count = #lb.players, capacity = lb.capacity }
        end
        LobbyEvent:FireClient(player, "lobbyList", summary)
    elseif action == "join" then
        local id = data and data.id
        local lb = lobbies[id]
        if lb and #lb.players < lb.capacity then
            table.insert(lb.players, player)
            player:SetAttribute("lobbyId", id)
            LobbyEvent:FireAllClients("lobbyJoined", { id = id, player = player.Name })
            -- auto start if full
            if #lb.players >= lb.capacity then
                -- start match
                LobbyEvent:FireAllClients("matchStarting", { id = id })
                GameCore.StartMatch(lb)
            end
            broadcastLobbyUpdate()
        else
            LobbyEvent:FireClient(player, "error", "No se puede unir al lobby.")
        end
    elseif action == "leave" then
        local id = player:GetAttribute("lobbyId")
        if id and lobbies[id] then
            local lb = lobbies[id]
            for i,p in ipairs(lb.players) do
                if p == player then table.remove(lb.players,i); break end
            end
            player:SetAttribute("lobbyId", nil)
            if #lb.players == 0 then lobbies[id] = nil end
            broadcastLobbyUpdate()
        end
    elseif action == "start" then
        local id = player:GetAttribute("lobbyId")
        local lb = id and lobbies[id]
        if lb and lb.host == player then
            LobbyEvent:FireAllClients("matchStarting", { id = id })
            GameCore.StartMatch(lb)
        end
    end
end)

Players.PlayerRemoving:Connect(function(plr)
    local id = plr:GetAttribute("lobbyId")
    if id and lobbies[id] then
        local lb = lobbies[id]
        for i,p in ipairs(lb.players) do
            if p == plr then table.remove(lb.players,i); break end
        end
        if #lb.players == 0 then lobbies[id] = nil end
        -- notify
        LobbyEvent:FireAllClients("playerLeft", { id = id, player = plr.Name })
    end
end)
        ]]
    end

    -- StarterPlayerScripts: ClientMain (LocalScript)
    local starterScripts = starterPlayer:FindFirstChild("StarterPlayerScripts") or makeInstance(starterPlayer, "StarterPlayerScripts", "StarterPlayerScripts")
    if not starterScripts:FindFirstChild("ClientMain") then
        local client = makeInstance(starterScripts, "LocalScript", "ClientMain")
        client.Source = [[
-- ClientMain: GUI + interaction with LobbyEvent
local RS = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local player = Players.LocalPlayer
local LobbyEvent = RS:WaitForChild("LobbyEvent")

-- Build simple GUI
local StarterGui = game:GetService("StarterGui")
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "OpenFrontGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

local main = Instance.new("Frame")
main.Name = "MainFrame"
main.Size = UDim2.new(0,360,0,220)
main.Position = UDim2.new(0.5,-180,0.1,0)
main.BackgroundColor3 = Color3.fromRGB(245,245,245)
main.Parent = screenGui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1,0,0,36)
title.Position = UDim2.new(0,0,0,0)
title.BackgroundTransparency = 1
title.Text = "© OpenFront and Contributors" -- Obligatorio por AGPL: mantener aviso visible
title.Font = Enum.Font.SourceSansBold
title.TextSize = 18
title.TextColor3 = Color3.new(0,0,0)
title.Parent = main

local hostBtn = Instance.new("TextButton")
hostBtn.Size = UDim2.new(0,160,0,36)
hostBtn.Position = UDim2.new(0,8,0,52)
hostBtn.Text = "Host Lobby"
hostBtn.Parent = main

local joinBtn = Instance.new("TextButton")
joinBtn.Size = UDim2.new(0,160,0,36)
joinBtn.Position = UDim2.new(0,184,0,52)
joinBtn.Text = "List / Join"
joinBtn.Parent = main

local listFrame = Instance.new("Frame")
listFrame.Size = UDim2.new(1,-16,0,96)
listFrame.Position = UDim2.new(0,8,0,100)
listFrame.BackgroundTransparency = 0.9
listFrame.Parent = main

local listLabel = Instance.new("TextLabel")
listLabel.Size = UDim2.new(1,0,1,0)
listLabel.BackgroundTransparency = 1
listLabel.Text = "Lobbies:"
listLabel.TextWrapped = true
listLabel.TextXAlignment = Enum.TextXAlignment.Left
listLabel.Parent = listFrame

hostBtn.MouseButton1Click:Connect(function()
    LobbyEvent:FireServer("host", { capacity = 8 })
end)

joinBtn.MouseButton1Click:Connect(function()
    LobbyEvent:FireServer("list")
end)

LobbyEvent.OnClientEvent:Connect(function(action, data)
    if action == "lobbyList" then
        local text = "Lobbies:\n"
        for id,info in pairs(data) do
            text = text .. string.format("[%s] Host:%s — %d/%d\n", id, info.host, info.count, info.capacity)
        end
        listLabel.Text = text
    elseif action == "lobbyJoined" then
        -- simple notification
        listLabel.Text = "Te uniste: "..(data.id or "unknown")
    elseif action == "matchStarting" then
        -- hide menu
        screenGui.Enabled = false
        -- basic in-game HUD
        local hud = Instance.new("ScreenGui")
        hud.Name = "InGameHUD"
        hud.Parent = player:WaitForChild("PlayerGui")
        local info = Instance.new("TextLabel")
        info.Size = UDim2.new(0,300,0,36)
        info.Position = UDim2.new(0,8,0,8)
        info.BackgroundTransparency = 0.5
        info.Text = "Partida iniciada!"
        info.Parent = hud
    elseif action == "error" then
        listLabel.Text = "Error: "..tostring(data)
    end
end)
        ]]
    end

    -- StarterGui: simple MainGui (for players who spawn)
    local starterGuiObj = starterGui:FindFirstChild("MainGui")
    if not starterGuiObj then
        local sg = Instance.new("ScreenGui")
        sg.Name = "MainGui"
        sg.Parent = starterGui
        local lbl = Instance.new("TextLabel")
        lbl.Name = "WelcomeText"
        lbl.Size = UDim2.new(0,300,0,36)
        lbl.Position = UDim2.new(0,8,0,8)
        lbl.BackgroundTransparency = 1
        lbl.Text = "OpenFront → Roblox (placeholder)"
        lbl.Parent = sg
    end

    -- Create Workspace placeholder map if not exists
    if not workspace:FindFirstChild("OpenFrontMap") then
        -- create a basic part so StartMatch has something (GameCore will also create)
        local map = Instance.new("Model")
        map.Name = "OpenFrontMap"
        map.Parent = workspace
        local base = Instance.new("Part")
        base.Name = "Base"
        base.Size = Vector3.new(200,2,200)
        base.Position = Vector3.new(0,0,0)
        base.Anchored = true
        base.Parent = map
    end

    plugin:CreatePluginAction("OpenFrontScaffoldCreated", "Scaffold created", "Scaffold creado")
    -- Notify user
    print("OpenFront → Roblox scaffold creado. Revisa ReplicatedStorage, ServerScriptService y StarterPlayerScripts.")
end

button.Click:Connect(function()
    createScaffold()
end)
