"use strict;"
/*!
 *  Bayrell Runtime Library
 *
 *  (c) Copyright 2016-2018 "Ildar Bikmamatov" <support@bayrell.org>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.bayrell.org/licenses/APACHE-LICENSE-2.0.html
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

if (typeof RuntimeUI == 'undefined') RuntimeUI = {};
if (typeof RuntimeUI.Drivers == 'undefined') RuntimeUI.Drivers = {};


RuntimeUI.Drivers.RenderDriver = class extends RuntimeUI.Render.CoreManager
{
	
	/**
	 * Warning
	 */
	warning()
	{
		var arr = Array.apply(null, arguments);
		arr.unshift("[Warning]");
		console.log.apply(null, arr);
	}
	
	
	/**
	 * Init Driver
	 */
	_init()
	{
		super._init();
		
		this.view = null;
		this.model = null;
		this.animation_id = null;
		this.control = new RuntimeUI.UIController();
		this.control.signal_out.addMethod(
			this.modelChanged.bind(this), 
			new Runtime.Collection("RuntimeUI.Events.ModelChange")
		);
		this.managers = {};
		this.managers_hash = {};
	}
	
	
	
	/**
	 * Returns value by name
	 */
	takeValue(variable_name, default_value)
	{
		if (default_value == undefined) default_value = null;
		if (variable_name == "control") return this.control;
		return super.takeValue(variable_name, default_value);
	}
	
	
	
	/**
	 * Model changed
	 */
	modelChanged(e)
	{
		this.model = e.model;
		this.runAnimation();
		/*console.log(e.model);*/
	}
	
	
	
	/**
	 * Save manager
	 */
	saveManager(class_name, key_manager, manager)
	{
		if (this.managers_hash[key_manager] == undefined) this.managers_hash[key_manager] = {};
		this.managers_hash[key_manager][class_name] = manager;
	}
	
	
	
	/**
	 * Search manager
	 */
	searchManager(key_path, class_name)
	{
		var keys = key_path.split(".");
		
		while (keys.length != 0)
		{
			var key = keys.join(".");
			if (this.managers_hash[key] != undefined)
			{
				if (this.managers_hash[key][class_name] != undefined)
				{
					return this.managers_hash[key][class_name];
				}
			}
			keys.pop();
		}
		
		return this;
	}
	
	
	
	/**
	 * Find managers
	 */
	findManager(item)
	{
		var class_name = item.ui.class_name;
		var key_path = item.key_ui;
		var manager = this.searchManager(key_path, class_name);
		
		/* console.log(key_path, class_name, manager); */
		
		return manager;
	}	
	
	
	
	/**
	 * Find parent managers
	 */
	findParentManager(item)
	{
		var class_name = item.ui.class_name;
		var key_path = item.key_ui;
		var keys = key_path.split("."); keys.pop();
		var manager = this.searchManager(keys.join("."), class_name);
		
		/* console.log(key_path, class_name, manager); */
		
		return manager;
	}
	
	
	
	/**
	 * Returns new manager
	 */
	createManager(parent_manager, ui, model, key_manager)
	{
		var manager_name = Runtime.rtl.method( ui.name, "managerName" )();
		var new_manager = null;
		var is_new = false;
		if (this.managers[key_manager] != undefined)
		{
			new_manager = this.managers[key_manager];
		}
		if (new_manager == null) is_new = true;
		else if (new_manager.getClassName() != manager_name) is_new = true;
		
		if (is_new)
		{
			/* Clear old link */
			if (new_manager != null)
			{
				new_manager.setParentManager(null, ""); /* Clear controller */
			}
			
			/* Create new manager */
			new_manager = Runtime.rtl.newInstance(manager_name);
			new_manager.setParentManager(parent_manager, ui.controller); /* Create link through controller */
			new_manager.model = model;
			
			this.managers[key_manager] = new_manager;
		}
		
		this.saveManager(ui.name, key_manager, new_manager);
		return new_manager;
	}
	
	
	
	/**
	 * Returns true if element and ui is different, and element must be recreated
	 */
	isElemDifferent(elem, item)
	{
		if (elem._ui == null) return false;
		if (elem._ui == item.ui) return false;
		
		/* Check if different struct kind or name */
		if (elem._ui.kind != item.ui.kind || elem._ui.name != item.ui.name)
		{
			return true;
		}
		
		/* Check if different manager */
		var manager = this.findManager(item);
		if (elem._manager != manager)
		{
			return true;
		}
		
		return false;
	}
	
	
	
	/**
	 * Update element props
	 */
	updateElemProps(elem, item)
	{
		var ref_name = null;
		var controller = null;
		var ui = item.ui;
		var manager = this.findManager(item);
		var key_path = item.key_ui;
		
		/* Is new element */
		if (elem._ui == null && ui.kind == "element")
		{
			elem._events = {};
			
			if (manager == null)
			{
				this.warning("Manager for item '" + key_path + "' not found in ", elem);
			}
			
			if (ui.controller != "" && manager != null)
			{
				controller = manager.takeValue(ui.controller);
				if (controller == null)
				{
					this.warning("Controller '" + ui.controller + "' not found in ", elem);
				}
				else
				{
					controller.ref = elem;
					if (controller.events != null)
					{
						for (var i=0; i<controller.events.count(); i++)
						{
							var class_name = controller.events.item(i);
							var f = Runtime.rtl.find_class(class_name);
							if (f)
							{
								var event_name = f.ES6_EVENT_NAME;
								
								if (
									event_name != "" && 
									event_name != undefined && 
									elem._events[event_name] == undefined
								)
								{
									elem.addEventListener(
										event_name, 
										(function(controller)
										{
											return function(e)
											{
												e = RuntimeUI.Events.UserEvent.UserEvent.fromEvent(e);
												controller.signal_out.dispatch(e);
											}
										})(controller)
									);
								}
							}
						}
					}
					
					/* Send mount event */
					controller.signal_out.dispatch( 
						new RuntimeUI.Events.MountEvent(new Runtime.Dict({
							"elem": elem,
							"ui": ui,
						})) 
					);
					
				}
			}
		}
		
		elem._manager = manager;
		elem._key = key_path;
		elem._ui = ui;
	}
	
	
	
	/**
	 * Update element attrs
	 */
	updateElemAttrs(elem, item)
	{
		/* Build attrs */
		var attrs = RuntimeUI.Render.RenderHelper.getUIAttrs(item.ui);
		if (attrs == null)
		{
			return;
		}
		
		var is_input = ["INPUT", "SELECT"].indexOf(elem.tagName) >= 0;
		attrs.each(
			(key, value) => 
			{
				if (is_input && key == "value") return;
				elem.setAttribute(key, value);
			}
		);
		
		if (is_input)
		{
			elem.value = attrs.get("value", "");
		}
		
		if (elem instanceof HTMLElement)
		{
			elem.setAttribute("x-key", item.key_ui);
		}
	}
	
	
	
	/**
	 * Create DOM by UI Struct
	 */
	createDOM(prev_elem, item)
	{
		if (prev_elem == undefined) prev_elem = null;
		
		/* If is component */
		if (item.ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			var elem = document.createElement(item.ui.name);
			this.updateElemProps(elem, item);
			
			/* Update element props */
			this.updateElemAttrs(elem, item);
			
			/* Update DOM children */
			if (prev_elem != null)
			{
				while (prev_elem.hasChildNodes()) 
				{
					elem.appendChild(prev_elem.firstChild);
				}
			}
			
			var manager = this.findManager(item);
			this.updateDOMChilds(manager, elem, item.ui.children, item.key_ui);
			
			return elem;
		}
		
		/* If is string */
		else if (item.ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			var elem = document.createTextNode(item.ui.content);
			this.updateElemProps(elem, item);
			return elem;
		}
		
		return null;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOM(elem, item)
	{
		if (elem._ui == item.ui) return elem;
		
		/* Create new DOM if elem and ui is different */
		if (this.isElemDifferent(elem, item))
		{
			return this.createDOM(elem, item);
		}
		
		this.updateElemProps(elem, item);
		if (item.ui.kind == Runtime.UIStruct.TYPE_ELEMENT)
		{
			/* Set props */
			this.updateElemAttrs(elem, item);
			
			/* Update DOM children */
			var manager = this.findManager(item);
			this.updateDOMChilds(manager, elem, item.ui.children, item.key_ui);
		}
		else if (item.ui.kind == Runtime.UIStruct.TYPE_RAW)
		{
			if (elem.nodeValue != item.ui.content)
				elem.nodeValue = item.ui.content;
		}
		
		return elem;
	}
	
	
	
	/**
	 * Unpack components
	 */
	unpackComponents(manager, template, key_path)
	{
		var index = 0;
		var arr = new Runtime.Vector();
		while (index < template.count())
		{
			var ui = template.item(index);
			var key_ui = Runtime.UIStruct.getKeyPath(ui, key_path, index);
			arr.push({ "ui": ui, "key_ui": key_ui + ""  });
			index++;
		}
		
		var arr2;
		var has_components = true;
		while (has_components)
		{
			index = 0;
			has_components = false;
			arr2 = new Runtime.Vector();
			while (index < arr.count())
			{
				var item = arr.item(index);
				var ui = item.ui;
				var key_ui = item.key_ui;
				index++;
				
				/* if ui is component */
				if (ui.kind == Runtime.UIStruct.TYPE_COMPONENT)
				{					
					/* Render view */
					var model = Runtime.UIStruct.getModel(ui);
					var f = Runtime.rtl.method( ui.name, "render" );
					var t = f( model, ui.children, ui.key );
					
					/* Find manager by path or create new manager if does not exists */
					var parent_manager = this.findParentManager(item);
					var new_manager = this.createManager(parent_manager, ui, model, key_ui);
					
					/* Normalize ui vector */
					if (!(t instanceof Runtime.Collection))
					{
						t = Runtime.RuntimeUtils.normalizeUIVector(t);
					}
					
					/* Analyze manager struct */
					for (var index_t=0; index_t<t.count(); index_t++)
					{
						var t_ui = t.item(index_t);
						var key_item = Runtime.UIStruct.getKeyPath(t_ui, key_ui, index_t);
						arr2.push({ "ui": t_ui, "key_ui": key_item, "manager": new_manager, });
						
						if (t_ui.kind == Runtime.UIStruct.TYPE_COMPONENT)
						{
							has_components = true;
						}
					}
				}
				
				/* if ui is element */
				else
				{
					arr2.push(item);
				}
				
			}
			
			arr = arr2.copy();
		}
		
		return arr;
	}
	
	
	
	/**
	 * Create Document Object Model
	 */
	updateDOMChilds(manager, elem, template, key_path)
	{
		var append_arr = [];
		var update_arr = [];
		var remove_arr = [];
		var index_elem = 0;
		
		/* If has childs */
		if (template != null)
		{
			var items = this.unpackComponents(manager, template, key_path);
			var index_item = 0;
			
			while (index_item < items.count())
			{
				var e = elem.childNodes[index_elem];
				var item = items.item(index_item);
				index_item++;
				index_elem++;
				
				if (e == undefined)
				{
					var e = this.createDOM(null, item);
					if (e != null) append_arr.push(e);
				}
				else
				{
					var new_item = this.updateDOM(e, item);
					if (new_item != e)
					{
						update_arr.push({"old_item": e, "new_item": new_item});
					}
				}
				
			}
			
		}
		
		
		/* Remove items */
		while (index_elem < elem.childNodes.length)
		{
			var e = elem.childNodes[index_elem];
			remove_arr.push(e);
			index_elem++;
		}
		
		
		/* Apply changes */
		for (var i=0; i<remove_arr.length; i++)
		{
			elem.removeChild( remove_arr[i] );
		}
		for (var i=0; i<append_arr.length; i++)
		{
			elem.appendChild( append_arr[i] );
		}
		for (var i=0; i<update_arr.length; i++)
		{
			elem.replaceChild(update_arr[i].new_item, update_arr[i].old_item);
		}
		
	}

	
	
	/**
	 * Run web driver
	 */
	run(selector, view, model)
	{
		model = Runtime.RuntimeUtils.json_decode( model );
		
		this.view = view;
		this.selector = selector;
		this.model = model;
		
		var root = document.querySelector( this.selector );
		root._driver = this;
		
		this.runAnimation();
	}
	
	
	/** Animation **/
	
	runAnimation()
	{
		this.animation_id = requestAnimationFrame( this.animation.bind(this) );
	}
	
	
	
	/**
	 * Animation function
	 */
	animation()
	{
		Runtime.rtl._memorizeClear();
		this.managers_hash = {};
		this.animation_id = null;
		var root = document.querySelector( this.selector );
		var template = new Runtime.Collection( 
			new Runtime.UIStruct(
				new Runtime.Dict({
					"name": this.view,
					"kind": Runtime.UIStruct.TYPE_COMPONENT,
					"model": this.model,
					"controller": "control",
				})
			)
		);
		this.updateDOMChilds(this, root, template, "")
	}
	
}



window['WebDriverApp'] = new RuntimeUI.Drivers.RenderDriver();
window['WebDriverApp'].run('#root', document.getElementById('view').value, document.getElementById('model').value);
