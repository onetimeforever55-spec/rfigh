-- Shop Module
-- Path: ReplicatedStorage/GameModules/Shop
-- Handles granting items for DevProduct purchases (Robux) or in-game coins

local Shop = {}
local Market = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local DataStoreModule = require(script.Parent:WaitForChild("DataStoreModule"))

-- Map devProductId -> item key and price (Robux handled by dev product)
Shop.DevProducts = {
    -- Example: [12345678] = { key = "gold_pack", coins = 1000 }
}

function Shop.GrantProductToPlayer(player, devProductId)
    local info = Shop.DevProducts[devProductId]
    if not info then return false end
    -- grant coins or items
    local data = player:GetAttribute("_openfront_data") or DataStoreModule.Load(player)
    data.coins = (data.coins or 0) + (info.coins or 0)
    -- store back on player for autosave
    player:SetAttribute("_openfront_data", data)
    return true
end

-- Simple in-game purchase using coins
function Shop.BuyWithCoins(player, itemKey, price)
    local data = player:GetAttribute("_openfront_data") or DataStoreModule.Load(player)
    if (data.coins or 0) >= price then
        data.coins = data.coins - price
        table.insert(data.inventory, itemKey)
        player:SetAttribute("_openfront_data", data)
        return true
    end
    return false
end

return Shop
