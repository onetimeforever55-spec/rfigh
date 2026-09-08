-- DataStoreModule
-- Path: ReplicatedStorage/GameModules/DataStoreModule
-- Simple DataStore wrapper for player stats and currency

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local StatsStore = DataStoreService:GetDataStore("OpenFrontPlayerStats_v1")

local DataStoreModule = {}
DataStoreModule.default = {
    coins = 0,
    inventory = {},
    cosmetics = {},
}

function DataStoreModule.Load(player)
    local key = "player_" .. player.UserId
    local success, data = pcall(function()
        return StatsStore:GetAsync(key)
    end)
    if success and data then
        return data
    else
        return DataStoreModule.default
    end
end

function DataStoreModule.Save(player, data)
    local key = "player_" .. player.UserId
    pcall(function()
        StatsStore:SetAsync(key, data)
    end)
end

-- Auto save on leave
Players.PlayerRemoving:Connect(function(player)
    local success, stored = pcall(function()
        -- assume there is an attribute table stored on player
        return player:GetAttribute("_openfront_data")
    end)
    if success and stored then
        DataStoreModule.Save(player, stored)
    end
end)

return DataStoreModule
