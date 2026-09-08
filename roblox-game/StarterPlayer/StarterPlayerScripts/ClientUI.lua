-- ClientUI (LocalScript)
-- Path: StarterPlayer/StarterPlayerScripts/ClientUI
-- Genera la interfaz completa y comunica con LobbyEvent/GameEvent en ReplicatedStorage

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer
local LobbyEvent = RS:WaitForChild("LobbyEvent")
local GameEvent = RS:FindFirstChild("GameEvent") or Instance.new("RemoteEvent", RS); GameEvent.Name = "GameEvent"

-- Create ScreenGui and main menu UI programmatically so paste->run works
local playerGui = player:WaitForChild("PlayerGui")
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "OpenFrontGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local function makeMainMenu()
    local frame = Instance.new("Frame")
    frame.Name = "MainFrame"
    frame.Size = UDim2.new(0,420,0,260)
    frame.Position = UDim2.new(0.5,-210,0.08,0)
    frame.BackgroundColor3 = Color3.fromRGB(240,240,240)
    frame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Name = "Title"
    title.Size = UDim2.new(1,0,0,36)
    title.Position = UDim2.new(0,0,0,0)
    title.BackgroundTransparency = 1
    title.Font = Enum.Font.SourceSansBold
    title.TextSize = 18
    title.Text = "© OpenFront and Contributors" -- AGPL attribution
    title.Parent = frame

    local hostBtn = Instance.new("TextButton")
    hostBtn.Name = "HostBtn"
    hostBtn.Size = UDim2.new(0,200,0,40)
    hostBtn.Position = UDim2.new(0.05,0,0,56)
    hostBtn.Text = "Host Lobby"
    hostBtn.Parent = frame

    local listBtn = Instance.new("TextButton")
    listBtn.Name = "ListBtn"
    listBtn.Size = UDim2.new(0,200,0,40)
    listBtn.Position = UDim2.new(0.5,0,0,56)
    listBtn.Text = "List / Join"
    listBtn.Parent = frame

    local invBtn = Instance.new("TextButton")
    invBtn.Name = "InvBtn"
    invBtn.Size = UDim2.new(0,200,0,36)
    invBtn.Position = UDim2.new(0.05,0,0,108)
    invBtn.Text = "Inventory"
    invBtn.Parent = frame

    local shopBtn = Instance.new("TextButton")
    shopBtn.Name = "ShopBtn"
    shopBtn.Size = UDim2.new(0,200,0,36)
    shopBtn.Position = UDim2.new(0.5,0,0,108)
    shopBtn.Text = "Shop"
    shopBtn.Parent = frame

    local listFrame = Instance.new("ScrollingFrame")
    listFrame.Name = "ListFrame"
    listFrame.Size = UDim2.new(1,-16,0,80)
    listFrame.Position = UDim2.new(0,8,0,156)
    listFrame.CanvasSize = UDim2.new(0,0,0,0)
    listFrame.BackgroundTransparency = 0.9
    listFrame.Parent = frame

    -- Event handlers
    hostBtn.MouseButton1Click:Connect(function()
        LobbyEvent:FireServer("host", { capacity = 8 })
    end)
    listBtn.MouseButton1Click:Connect(function()
        LobbyEvent:FireServer("list")
    end)
    invBtn.MouseButton1Click:Connect(function()
        showInventory()
    end)
    shopBtn.MouseButton1Click:Connect(function()
        showShop()
    end)

    return frame, listFrame
end

-- inventory/shop simple modals (local only, placeholder)
local inventoryFrame
function showInventory()
    if inventoryFrame and inventoryFrame.Parent then return end
    inventoryFrame = Instance.new("Frame")
    inventoryFrame.Size = UDim2.new(0,380,0,220)
    inventoryFrame.Position = UDim2.new(0.5,-190,0.6,0)
    inventoryFrame.BackgroundColor3 = Color3.fromRGB(250,250,250)
    inventoryFrame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Text = "Inventory (placeholder)"
    title.Size = UDim2.new(1,0,0,30)
    title.BackgroundTransparency = 1
    title.Parent = inventoryFrame

    local close = Instance.new("TextButton")
    close.Text = "Close"
    close.Size = UDim2.new(0,80,0,28)
    close.Position = UDim2.new(1,-88,0,36)
    close.Parent = inventoryFrame
    close.MouseButton1Click:Connect(function() inventoryFrame:Destroy() end)
end

local shopFrame
function showShop()
    if shopFrame and shopFrame.Parent then return end
    shopFrame = Instance.new("Frame")
    shopFrame.Size = UDim2.new(0,380,0,220)
    shopFrame.Position = UDim2.new(0.5,-190,0.6,0)
    shopFrame.BackgroundColor3 = Color3.fromRGB(250,250,250)
    shopFrame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Text = "Shop (placeholder)"
    title.Size = UDim2.new(1,0,0,30)
    title.BackgroundTransparency = 1
    title.Parent = shopFrame

    local close = Instance.new("TextButton")
    close.Text = "Close"
    close.Size = UDim2.new(0,80,0,28)
    close.Position = UDim2.new(1,-88,0,36)
    close.Parent = shopFrame
    close.MouseButton1Click:Connect(function() shopFrame:Destroy() end)
end

-- HUD during match
local function showInGameHUD()
    local hud = Instance.new("ScreenGui")
    hud.Name = "InGameHUD"
    hud.Parent = player:WaitForChild("PlayerGui")
    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(0,240,0,30)
    label.Position = UDim2.new(0,8,0,8)
    label.BackgroundTransparency = 0.4
    label.Text = "Match in progress..."
    label.Parent = hud
end

-- Initialize main menu
local mainFrame, listFrame = makeMainMenu()

-- Handle remote events from server
LobbyEvent.OnClientEvent:Connect(function(action, data)
    if action == "lobbyList" then
        -- clear listFrame
        for _,c in ipairs(listFrame:GetChildren()) do c:Destroy() end
        local y = 0
        for id,info in pairs(data) do
            local btn = Instance.new("TextButton")
            btn.Size = UDim2.new(1,-8,0,24)
            btn.Position = UDim2.new(0,4,0,y)
            btn.Text = string.format("[%s] %s — %d/%d (%s)", id, info.host, info.count, info.capacity, info.status)
            btn.Parent = listFrame
            btn.MouseButton1Click:Connect(function()
                LobbyEvent:FireServer("join", { id = id })
            end)
            y = y + 28
        end
        listFrame.CanvasSize = UDim2.new(0,0,0,y)
    elseif action == "hostCreated" then
        -- notify host
        local id = data and data.id or "?"
        warn("Lobby hosted: "..id)
    elseif action == "playerJoinedLobby" then
        -- minimal notif
        print("Player joined lobby:", data.player)
    elseif action == "matchStarting" then
        -- hide main menu and show HUD
        if mainFrame and mainFrame.Parent then mainFrame.Visible = false end
        showInGameHUD()
    elseif action == "error" then
        -- show error on list
        warn("Lobby error:", tostring(data))
    end
end)

-- GameEvent (in-game server notifications)
GameEvent.OnClientEvent:Connect(function(action, data)
    if action == "pickupCollected" then
        -- flash or play sound (placeholder)
        print("Pickup collected:", data.id)
    elseif action == "matchEnded" then
        -- show a simple result screen
        local resultGui = Instance.new("ScreenGui")
        resultGui.Name = "ResultGui"
        resultGui.Parent = player:WaitForChild("PlayerGui")
        local lbl = Instance.new("TextLabel")
        lbl.Size = UDim2.new(0,360,0,120)
        lbl.Position = UDim2.new(0.5,-180,0.4,0)
        lbl.Text = "Match ended! Winner: "..tostring(data.winner)
        lbl.Parent = resultGui
        wait(6)
        resultGui:Destroy()
        if mainFrame then mainFrame.Visible = true end
    end
end)
