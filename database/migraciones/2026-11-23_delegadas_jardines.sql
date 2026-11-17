-- DATOS — Delegadas de jardín (V7): quién ve "Mi jardín" en el portal de socias
-- Para bases YA INSTALADAS con el padrón cargado. Aplicar DESPUÉS de 2026-11-22_solicitudes_sos.sql.
-- phpMyAdmin > seleccionar la base > pestaña SQL > pegar y ejecutar.
-- Se puede ejecutar más de una vez: solo marca, nunca desmarca a nadie.

SET NAMES utf8mb4;

-- Lista entregada por la directiva el 17-11-2026: una delegada por jardín.
-- Faltan J-04 Gabriela Mistral y J-10 Los Jardines de Labranza (sin delegada aún).
-- Se compara el RUT sin puntos ni guion y se exige que la socia esté ACTIVA y en ese jardín,
-- así una socia trasladada o retirada no queda marcada en un jardín que no es el suyo.
UPDATE `socias` s
JOIN `jardines` j ON j.id = s.jardin_id
JOIN (
    SELECT 'J-01' AS codigo, '193052266' AS rut UNION ALL
    SELECT 'J-02', '154656359' UNION ALL
    SELECT 'J-03', '172622801' UNION ALL
    SELECT 'J-05', '174831491' UNION ALL
    SELECT 'J-06', '184849135' UNION ALL
    SELECT 'J-07', '17261311K' UNION ALL
    SELECT 'J-08', '138016625' UNION ALL
    SELECT 'J-09', '169962014' UNION ALL
    SELECT 'J-11', '171463815' UNION ALL
    SELECT 'J-12', '152414374' UNION ALL
    SELECT 'J-13', '17585455K' UNION ALL
    SELECT 'J-14', '166731267' UNION ALL
    SELECT 'J-15', '155416866' UNION ALL
    SELECT 'J-16', '179172038' UNION ALL
    SELECT 'J-17', '158654563' UNION ALL
    SELECT 'J-18', '127097321' UNION ALL
    SELECT 'J-19', '169504113' UNION ALL
    SELECT 'J-20', '179176378' UNION ALL
    SELECT 'J-21', '127097569' UNION ALL
    SELECT 'J-22', '18728242K' UNION ALL
    SELECT 'J-23', '15260758K'
) d ON d.codigo = j.codigo
   AND d.rut = UPPER(REPLACE(REPLACE(REPLACE(s.rut, '.', ''), '-', ''), ' ', ''))
SET s.es_delegada = 1
WHERE s.estado = 'ACTIVA';

-- Verificación: deben aparecer 21 jardines con su delegada y J-04 / J-10 con "SIN DELEGADA".
-- Si otro jardín sale "SIN DELEGADA", esa socia cambió de jardín o de estado: marcarla a mano en Socias.
SELECT j.codigo,
       j.nombre AS jardin,
       COALESCE(GROUP_CONCAT(CONCAT(s.nombres, ' ', s.apellido_paterno) SEPARATOR ', '), 'SIN DELEGADA') AS delegada
FROM `jardines` j
LEFT JOIN `socias` s ON s.jardin_id = j.id AND s.es_delegada = 1 AND s.estado = 'ACTIVA'
GROUP BY j.id, j.codigo, j.nombre
ORDER BY j.codigo;
