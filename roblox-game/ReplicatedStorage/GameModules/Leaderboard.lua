-- Leaderboard (ModuleScript)
-- Path intended for Roblox: ReplicatedStorage/GameModules/Leaderboard
-- Crea/actualiza leaderstats simple y helpers

local Leaderboard = {}
local Players = game:GetService("Players")

function Leaderboard.SetupPlayer(player)
    if player:FindFirstChild("leaderstats") then return end
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player

    local score = Instance.new("IntValue")
    score.Name = "Score"
    score.Value = 0
    score.Parent = leaderstats

    local kills = Instance.new("IntValue")
    kills.Name = "Kills"
    kills.Value = 0
    kills.Parent = leaderstats
end

function Leaderboard.AddScore(player, amount)
    if player and player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Score") then
        player.leaderstats.Score.Value = player.leaderstats.Score.Value + amount
    end
end

function Leaderboard.AddKill(player, amount)
    if player and player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Kills") then
        player.leaderstats.Kills.Value = player.leaderstats.Kills.Value + amount
    end
end

-- Setup on join
Players.PlayerAdded:Connect(function(p)
    Leaderboard.SetupPlayer(p)
end)

return Leaderboard
