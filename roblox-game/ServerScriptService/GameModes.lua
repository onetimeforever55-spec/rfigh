-- GameModes.lua
-- Path: ServerScriptService/GameModes
-- Implements match modes: deathmatch (default) and doomsday (shrinking zone)

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local Combat = require(game:GetService("ReplicatedStorage"):WaitForChild("GameModules"):WaitForChild("Combat"))

local GameModes = {}

-- Deathmatch: no extra rules (placeholder)
function GameModes.Deathmatch(match)
    -- match: { players = {...}, endsAt = tick() + duration }
    -- nothing special done on server here; gameplay handled by GameServer
    while tick() < match.endsAt do
        wait(1)
    end
end

-- Doomsday: shrinking safe zone that damages players outside
function GameModes.Doomsday(match)
    local duration = math.max(30, (match.endsAt - tick()))
    local startRadius = 220
    local endRadius = 40
    local center = Vector3.new(0,0,0)
    local start = tick()
    while tick() < match.endsAt do
        local elapsed = tick() - start
        local t = math.clamp(elapsed / duration, 0, 1)
        local radius = startRadius * (1 - t) + endRadius * t
        -- damage players outside radius every 1s
        for _,p in ipairs(match.players) do
            if p and p.Character and p.Character:FindFirstChild("HumanoidRootPart") then
                local pos = p.Character.HumanoidRootPart.Position
                local dist = (pos - center).Magnitude
                if dist > radius then
                    local humanoid = p.Character:FindFirstChild("Humanoid")
                    if humanoid and humanoid.Health > 0 then
                        -- damage scales with distance beyond the radius
                        local over = dist - radius
                        local dmg = math.clamp(math.floor(5 + over * 0.25), 1, 45)
                        Combat.ApplyDamage(p.Character, dmg, nil)
                    end
                end
            end
        end
        wait(1)
    end
end

-- Entrypoint: choose mode
function GameModes.RunMatch(id, match, mode)
    mode = mode or "deathmatch"
    if mode == "doomsday" then
        GameModes.Doomsday(match)
    else
        GameModes.Deathmatch(match)
    end
end

return GameModes
