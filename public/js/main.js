document.addEventListener('DOMContentLoaded', function() {
    const tipoEquipoSelect = document.getElementById('tipoEquipo');
    const listaEquiposSelect = document.getElementById('listaEquipos');
    const btnAgregarEquipo = document.getElementById('btnAgregarEquipo');
    const equiposAgregadosList = document.getElementById('equiposAgregados');

    if (tipoEquipoSelect) {
        tipoEquipoSelect.addEventListener('change', async function() {
            const tipo = this.value;
            if (!tipo) return;

            listaEquiposSelect.disabled = true;
            listaEquiposSelect.innerHTML = '<option>Cargando...</option>';
            btnAgregarEquipo.disabled = true;

            try {
                const response = await fetch(`/admin/api/equipos/${tipo}`);
                if (!response.ok) throw new Error('Error en la respuesta del servidor');
                const equipos = await response.json();

                listaEquiposSelect.innerHTML = '<option value="" disabled selected>Seleccione un equipo...</option>';
                equipos.forEach(equipo => {
                    const optionText = `${equipo.numero_inventario} - ${equipo.fabricante || ''} ${equipo.modelo || ''} (S/N: ${equipo.serial || 'N/A'})`;
                    const option = new Option(optionText, `${tipo}|${equipo.id}`);
                    listaEquiposSelect.add(option);
                });

                listaEquiposSelect.disabled = false;
            } catch (error) {
                console.error('Error al cargar equipos:', error);
                listaEquiposSelect.innerHTML = '<option>Error al cargar</option>';
            }
        });
    }

    if (listaEquiposSelect) {
        listaEquiposSelect.addEventListener('change', function() {
            btnAgregarEquipo.disabled = !this.value;
        });
    }

    if (btnAgregarEquipo) {
        btnAgregarEquipo.addEventListener('click', function() {
            const selectedOption = listaEquiposSelect.options[listaEquiposSelect.selectedIndex];
            if (!selectedOption || !selectedOption.value) return;

            const valor = selectedOption.value;
            const texto = selectedOption.text;

            // Evitar duplicados
            if (document.querySelector(`input[value="${valor}"]`)) {
                alert('Este equipo ya ha sido agregado.');
                return;
            }

            if (equiposAgregadosList.querySelector('.text-muted')) {
                equiposAgregadosList.innerHTML = '';
            }

            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.innerHTML = `${texto} <input type="hidden" name="equipos[]" value="${valor}">`;
            equiposAgregadosList.appendChild(li);
        });
    }
});