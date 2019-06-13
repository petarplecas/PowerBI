# Using InteractivityUtils

The utility package [InteractivityUtils](https://github.com/Microsoft/powerbi-visuals-utils-interactivityutils) provides a set of functions and interfaces that simplify cross-visual data point selection and filtering. 

The Sample Slicer visual has all selection-related logic located in one file [*selectionBehavior.ts*](/src/selectionBehavior.ts).

For <b>discrete</b> cross-visual data-point selection the Sample Slicer visual relies on the interface [ISelectionHandler](https://github.com/Microsoft/powerbi-visuals-utils-interactivityutils/blob/master/src/interactivityservice.ts) of the InteractivityUtils package. 

ISelectionHandler holds the state of all discrete (possibly multiple) data-point selections. The handler is updated on each data-point selection event (each mouse click) and does NOT automatically propagate the event to the hosting application. The selection state is only propagated to the host when the method ISelectionHandler.applySelectionFilter() is invoked. 

Below is the code executed on each slicer mouse click. The handler is updated with the select/unselect data point event and the complete discrete selection state is flushed to the hosting application. Additionally, the selection state is persisted to the visual's properties as applyed filter, so the next time the visual is loaded the selection can be restored.

```
      /* update selection state */
      selectionHandler.handleSelection(dataPoint, true /* isMultiSelect */);

      /* send selection state to the host*/
      selectionHandler.applySelectionFilter();
```

An instance implementing ISelectionHandler interface is created by InteractivityUtils and supplied to SelectionBehavior class as an argument of SelectionBehavior::bindEvents() method call. 
