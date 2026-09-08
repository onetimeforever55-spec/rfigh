-- ClientUI expanded (LocalScript)
-- Adds inventory, shop UI and firing support (client-side)

local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local player = Players.LocalPlayer
local LobbyEvent = RS:WaitForChild("LobbyEvent")
local GameEvent = RS:WaitForChild("GameEvent")
local ActionEvent = RS:FindFirstChild("GameAction") or Instance.new("RemoteEvent", RS); ActionEvent.Name = "GameAction"

local playerGui = player:WaitForChild("PlayerGui")
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "OpenFrontGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- UI factories
local function makeMainMenu()
    local frame = Instance.new("Frame")
    frame.Name = "MainFrame"
    frame.Size = UDim2.new(0,420,0,300)
    frame.Position = UDim2.new(0.5,-210,0.06,0)
    frame.BackgroundColor3 = Color3.fromRGB(240,240,240)
    frame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Name = "Title"
    title.Size = UDim2.new(1,0,0,36)
    title.Position = UDim2.new(0,0,0,0)
    title.BackgroundTransparency = 1
    title.Font = Enum.Font.SourceSansBold
    title.TextSize = 18
    title.Text = "© OpenFront and Contributors"
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
    listFrame.Size = UDim2.new(1,-16,0,120)
    listFrame.Position = UDim2.new(0,8,0,156)
    listFrame.CanvasSize = UDim2.new(0,0,0,0)
    listFrame.BackgroundTransparency = 0.9
    listFrame.Parent = frame

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

-- Inventory modal
local inventoryFrame
function showInventory()
    if inventoryFrame and inventoryFrame.Parent then return end
    inventoryFrame = Instance.new("Frame")
    inventoryFrame.Size = UDim2.new(0,380,0,260)
    inventoryFrame.Position = UDim2.new(0.5,-190,0.6,0)
    inventoryFrame.BackgroundColor3 = Color3.fromRGB(250,250,250)
    inventoryFrame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Text = "Inventory"
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

-- Shop modal (local purchases: coins) - purchases with Robux are processed server-side via DevProducts
local shopFrame
function showShop()
    if shopFrame and shopFrame.Parent then return end
    shopFrame = Instance.new("Frame")
    shopFrame.Size = UDim2.new(0,420,0,300)
    shopFrame.Position = UDim2.new(0.5,-210,0.5,0)
    shopFrame.BackgroundColor3 = Color3.fromRGB(250,250,250)
    shopFrame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Text = "Shop"
    title.Size = UDim2.new(1,0,0,30)
    title.BackgroundTransparency = 1
    title.Parent = shopFrame

    -- Example item: buy with Robux via DevProduct
    local prodBtn = Instance.new("TextButton")
    prodBtn.Size = UDim2.new(0,200,0,36)
    prodBtn.Position = UDim2.new(0.5,-100,0,56)
    prodBtn.Text = "Buy 1000 coins (Robux)"
    prodBtn.Parent = shopFrame
    prodBtn.MouseButton1Click:Connect(function()
        -- Open purchase prompt for dev product id (replace 0 with real product id)
        local devProductId = 0 -- REPLACE with actual dev product id
        game:GetService("MarketplaceService"):PromptProductPurchase(player, devProductId)
    end)

    local close = Instance.new("TextButton")
    close.Text = "Close"
    close.Size = UDim2.new(0,80,0,28)
    close.Position = UDim2.new(1,-88,0,36)
    close.Parent = shopFrame
    close.MouseButton1Click:Connect(function() shopFrame:Destroy() end)
end

-- In-game HUD
local function showInGameHUD()
    local hud = Instance.new("ScreenGui")
    hud.Name = "InGameHUD"
    hud.Parent = player:WaitForChild("PlayerGui")
    local label = Instance.new("TextLabel")
    label.Size = UDim2.new(0,240,0,30)
    label.Position = UDim2.new(0,8,0,8)
    label.BackgroundTransparency = 0.4
    label.Text = "Match in progress... Press LMB to fire"
    label.Parent = hud

    -- enable firing with mouse
    local mouse = player:GetMouse()
    local equippedWeapon = "pistol"
    mouse.Button1Down:Connect(function()
        local char = player.Character
        if not char or not char:FindFirstChild("HumanoidRootPart") then return end
        local origin = char.HumanoidRootPart.Position
        local targetPos = mouse.Hit and mouse.Hit.p or (origin + (workspace.CurrentCamera.CFrame.LookVector * 100))
        -- send fire action to server
        ActionEvent:FireServer("fire", { origin = origin, target = targetPos, weapon = equippedWeapon })
    end)
end

-- Initialize
local mainFrame, listFrame = makeMainMenu()

LobbyEvent.OnClientEvent:Connect(function(action, data)
    if action == "lobbyList" then
        for _,c in ipairs(listFrame:GetChildren()) do c:Destroy() end
        local y = 0
        for id,info in pairs(data) do
            local btn = Instance.new("TextButton")
            btn.Size = UDim2.new(1,-8,0,28)
            btn.Position = UDim2.new(0,4,0,y)
            btn.Text = string.format("[%s] %s — %d/%d (%s)", id, info.host, info.count, info.capacity, info.status)
            btn.Parent = listFrame
            btn.MouseButton1Click:Connect(function()
                LobbyEvent:FireServer("join", { id = id })
            end)
            y = y + 32
        end
        listFrame.CanvasSize = UDim2.new(0,0,0,y)
    elseif action == "hostCreated" then
        warn("Lobby hosted: "..tostring(data.id))
    elseif action == "matchStarting" then
        if mainFrame and mainFrame.Parent then mainFrame.Visible = false end
        showInGameHUD()
    end
end)

GameEvent.OnClientEvent:Connect(function(action, data)
    if action == "pickupCollected" then
        -- handle pickup UI
        print("Pickup collected:", data.id)
    elseif action == "matchEnded" then
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
