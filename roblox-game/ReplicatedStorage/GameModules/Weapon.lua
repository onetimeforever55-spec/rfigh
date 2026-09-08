-- Weapon Module
-- Path: ReplicatedStorage/GameModules/Weapon
-- Weapon definitions and helpers

local Weapon = {}

Weapon.configs = {
    pistol = {
        name = "Pistol",
        damage = 25,
        range = 200,
    },
    rifle = {
        name = "Rifle",
        damage = 40,
        range = 400,
    }
}

function Weapon.Get(name)
    return Weapon.configs[name]
end

return Weapon
