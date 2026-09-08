OpenFront -> Roblox (Instalación rápida)
=======================================

1) En Roblox Studio, abra la vista Explorer y Script Editor.
2) Crea las carpetas y archivos (o pega los scripts) exactamente en estas rutas:
   - ReplicatedStorage/GameModules/GameCore (ModuleScript) -> pegar el contenido de GameCore (ModuleScript)
   - ReplicatedStorage/GameModules/Leaderboard (ModuleScript) -> pegar
   - ServerScriptService/Matchmaking (Script) -> pegar
   - ServerScriptService/GameServer (Script) -> pegar
   - StarterPlayer/StarterPlayerScripts/ClientUI (LocalScript) -> pegar

   Si prefieres, usa el plugin que te proporcioné anteriormente para crear el scaffold y luego reemplaza los ModuleScripts/ServerScripts/LocalScripts con los contenidos de esta entrega.

3) Ejecuta "Play" en Studio (Start Server + 1 Player) para probar:
   - Abre la UI (aparecerá en pantalla).
   - Presiona "Host Lobby" para crear uno o "List / Join" para ver lobbies.
   - Emula varios players (Start server + players) para probar matchmaking y el inicio de la partida.
   - Encontrarás recogibles (pickups) en Workspace/OpenFrontMap que otorgan puntos al tocarlos.

4) Activos (imágenes/sounds):
   - Sustituye colores/partes por modelos y assets tuyos. Donde necesites imágenes usa rbxassetid://ID dentro de ImageLabel.Image en GUIs.
   - NO uses archivos en /proprietary del repo original; están marcados como propietarios.
   - Mantén visible la cadena de atribución: "© OpenFront and Contributors" en la UI.

5) Siguientes mejoras que puedo programar (elige):
   - A) Convertir e implementar todos los modals convertidos (HostLobby avanzado, JoinLobby con filtros, Inventory completo con DataStore).
   - B) Implementar mecánicas completas de juego: armas, daño, respawn avanzado, powerups, mapas múltiples.
   - C) Animaciones UI (TweenService) y skinning para que se parezca visualmente al frontend original.

Dime la opción A/B/C o "continua" y sigo con la siguiente entrega (convertir todos los modals y la lógica detallada).
